defmodule Sup.Poller do
  @moduledoc """
  Bulk of Sup, the actual polling behaviour. It will check S3 for a newer version/package stamp every
  second and pull and start that version/package stamp as a docker container or systemd unit.
  """
  use GenServer
  require Logger

  # How often we poll the S3 bucket.
  @poll_period_secs 5

  defmodule State do
    defstruct [:current_version]
  end

  def start_link(args) do
    GenServer.start_link(__MODULE__, args)
  end

  def init(_args) do
    current_version =
      case File.read("/var/run/sup/#{Sup.subsystem()}-current.txt") do
        {:ok, contents} -> String.trim(contents)
        _ -> "<<no current version>>"
      end

    send(self(), :poll)
    {:ok, %State{current_version: current_version}}
  end

  def handle_info(:poll, state) do
    Logger.info("Started poll")

    state =
      case check_new_version(state) do
        nil ->
          state

        target_version ->
          {:ok, new_version} =
            Application.fetch_env!(:sup, :launcher).launch(
              state.current_version,
              target_version
            )

          %{state | current_version: new_version}
      end

    Process.send_after(self(), :poll, @poll_period_secs * 1_000)

    {:noreply, state}
  end

  defp check_new_version(state) do
    bucket = System.get_env("SUP_VERSION_BUCKET", "canary-private")
    path = System.get_env("SUP_VERSION_PATH", "version-stamps")

    {:ok, %{body: body}} =
      ExAws.S3.get_object(
        bucket,
        "#{path}/#{Sup.subsystem()}-latest#{Sup.qualifier()}.txt"
      )
      |> ExAws.request(region: "us-west-2")

    new_version = String.trim(body)

    if new_version == state.current_version do
      Logger.info("No new version")
      nil
    else
      Logger.info("New version found")
      new_version
    end
  end
end
