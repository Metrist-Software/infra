defmodule Sup.Launcher do
  require Logger

  @type container_or_package :: binary()

  @callback launch(previous :: container_or_package(), target_container :: container_or_package()) ::
              {:ok, new :: container_or_package()} | {:error, result :: term()}

  def template_env_file_name, do: "/var/lib/sup/#{Sup.subsystem()}.env"
  def expanded_env_file_name, do: "/var/run/sup/#{Sup.subsystem()}.expanded.env"

  # If we have a HEALTH_CHECK environment variable, we will interpret that as a URL and linger until it returns OK
  def maybe_wait_for_health_check(),
    do: maybe_wait_for_health_check(System.get_env("HEALTH_CHECK"))

  def maybe_wait_for_health_check(nil) do
    Logger.info("No health check configure, sleeping for 5 seconds just to be sure")
    Process.sleep(5_000)
    :ok
  end

  def maybe_wait_for_health_check(url) do
    case HTTPoison.get(url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: _body}} ->
        Logger.info("Health check ok")
        :ok

      other ->
        Logger.info("Health check failed, sleeping: #{inspect(other)}")
        Process.sleep(5_000)
        maybe_wait_for_health_check(url)
    end
  end
end

defmodule Sup.Launcher.Dummy do
  @behaviour Sup.Launcher

  def launch(_previous_container, target_container) do
    {:ok, target_container}
  end
end

defmodule Sup.Launcher.Docker do
  require Logger
  @behaviour Sup.Launcher

  # How long to give Docker stop before it sends a kill. It's better to allow processes to
  # gracefully exit, so we give it plenty of time (usually it's quicker than this)
  @docker_stop_timeout_secs 30

  def launch(previous_container, target_container) do
    Logger.info(
      "<<< Launching new container #{target_container}, upgrade from #{previous_container}"
    )

    # We do this every time so that we get the latest parameter store values.
    Sup.EnvFile.expand_file(
      Sup.Launcher.template_env_file_name(),
      Sup.Launcher.expanded_env_file_name()
    )

    # We do this every time so that the docker login does't time out
    maybe_login(target_container)
    Sup.cloud_platform_module().create_log_stream(target_container)
    run_docker(["pull", target_container])

    new_container =
      :global.trans({Sup.Poller.RolloutLock, self()}, fn ->
        locked_launch_container(previous_container, target_container)
      end)

    Logger.info(">>> New container #{new_container} launched")
    cleanup_docker_images()
    {:ok, new_container}
  end

  defp locked_launch_container(previous_container, container) do
    Logger.info("--- Have lock, starting upgrade")
    Sup.cloud_platform_module().maybe_deregister_target()
    run_docker(["stop", "-t", "#{@docker_stop_timeout_secs}", Sup.subsystem()])
    run_docker(["rm", Sup.subsystem()])

    args = """
      run -d --restart unless-stopped
        --env-file #{Sup.Launcher.expanded_env_file_name()}
        --network host
        --name #{Sup.subsystem()}
        --memory #{memory_limit()}
        #{Sup.cloud_platform_module().logging_options(container)}
        #{container}
    """

    new_container =
      case run_docker(args) do
        :ok ->
          File.write!("/var/run/sup/#{Sup.subsystem()}-current.txt", container)
          container

        _err ->
          Logger.error("Could not start container, retrying next poll period")
          previous_container
      end

    Sup.Launcher.maybe_wait_for_health_check()
    Sup.cloud_platform_module().maybe_register_target()
    Logger.info("--- Release lock")
    new_container
  end

  # This is not cloud platform module specific because it should be ok to point at containers
  # cross-platform.
  defp maybe_login(container) do
    Logger.debug("maybe login? #{container}")

    if String.match?(container, ~r/[0-9]+\.dkr\.ecr\.[a-z0-9-]+\.amazonaws.com/) do
      Logger.debug("- yes, is ECR repo")

      ecr_repository =
        container
        |> String.split("/")
        |> Enum.at(0)

      do_ecr_login(ecr_repository)
    end
  end

  defp do_ecr_login(repo) do
    region = String.replace(repo, ~r/[0-9]+\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws.com/, "\\1")

    cmd =
      "aws ecr get-login-password --region #{region} | docker login --username AWS --password-stdin #{repo}"

    Logger.debug("Doing ECR login with region #{region} and command '#{cmd}'")
    Sup.do_cmd("bash", ["-c", cmd])
  end

  defp cleanup_docker_images() do
    Logger.info("<<< Cleaning up old images")
    # all our images are tagged so we need --all. --force will disable the confirmation prompt
    run_docker(["image", "prune", "--all", "--force"])
    Logger.info(">>> Cleanup of old images complete")
  end

  defp run_docker(args) when is_list(args) do
    Sup.do_cmd("docker", args)
  end

  defp run_docker(args) when is_binary(args) do
    run_docker(String.split(args))
  end

  # We run containers with 85% of available memory. That is above the default 80% alarm
  # size of mem_sup so that individual services have a chance to take measures.
  # Note: this is a hard limit set on the container's cgroup, so the kernel will OOM
  # kill the container.
  @memory_limit 0.85
  defp memory_limit do
    {total, _alloc, _worst} = :memsup.get_memory_data()
    round(total * @memory_limit)
  end
end

defmodule Sup.Launcher.Debian do
  require Logger

  def launch(previous_package, target_package) do
    Logger.info("<<< Installing new package #{target_package}, upgrade from #{previous_package}")

    s3_package_path =
      "s3://canary-private/linux-packages/#{Application.fetch_env!(:sup, :distribution_name)}/#{Application.fetch_env!(:sup, :distribution_version)}/#{target_package}"

    :ok = Sup.do_cmd("aws", ["s3", "cp", s3_package_path, "/tmp/#{target_package}"])

    Sup.EnvFile.expand_file(
      Sup.Launcher.template_env_file_name(),
      Sup.Launcher.expanded_env_file_name()
    )

    new_package =
      :global.trans({Sup.Poller.RolloutLock, self()}, fn ->
        locked_launch_package(previous_package, target_package)
      end)

    File.rm("/tmp/#{target_package}")

    Logger.info(">>> New package #{new_package} launched")
    {:ok, new_package}
  end

  def locked_launch_package(previous_package, target_package) do
    Logger.info("--- Have lock, starting upgrade")
    service_file = "#{Sup.subsystem()}.service"

    new_package =
      with :ok <-
             Sup.do_cmd("sudo", [
               "apt",
               "install",
               "-y",
               "--allow-downgrades",
               "/tmp/#{target_package}"
             ]),
           :ok <- write_vector_config(target_package),
           :ok <- Sup.cloud_platform_module().maybe_deregister_target(),
           :ok <- Sup.do_cmd("sudo", ["systemctl", "daemon-reload"]),
           :ok <- Sup.do_cmd("sudo", ["systemctl", "restart", "vector.service"]),
           :ok <- Sup.do_cmd("sudo", ["systemctl", "enable", service_file]),
           :ok <- Sup.do_cmd("sudo", ["systemctl", "restart", service_file]),
           :ok <- Sup.Launcher.maybe_wait_for_health_check(),
           :ok <- Sup.cloud_platform_module().maybe_register_target() do
        File.write!("/var/run/sup/#{Sup.subsystem()}-current.txt", target_package)
        target_package
      else
        err ->
          Logger.error(
            "Could not start package, retrying next poll period. Reason: #{inspect(err)}"
          )

          previous_package
      end

    Logger.info("--- Release lock")
    new_package
  end

  defp write_vector_config(package_name) do
    group_name =
      case Sup.subsystem() do
        "metrist-" <> group -> group
        subsystem -> subsystem
      end

    [_package, dist_and_version, _rest] = String.split(package_name, "_")
    [short_rev | _rest] = String.split(dist_and_version, "-") |> Enum.reverse()

    config = """
    [sources.metrist_backend_journald]
    type = "journald"
    current_boot_only = true
    include_units = [ "metrist-backend" ]

    [sinks.backend_cw_log]
    type = "aws_cloudwatch_logs"
    inputs = [ "metrist_backend_journald" ]
    create_missing_group = true
    create_missing_stream = true
    group_name = "#{Sup.environment()}-#{group_name}-logs"
    region = "#{Sup.aws_region()}"
    stream_name = "{{ host }}/#{short_rev}"
    healthcheck.enabled = false
    encoding.codec = "text"
    """

    File.write("/etc/vector/#{Sup.subsystem()}.toml", config)
  end
end
