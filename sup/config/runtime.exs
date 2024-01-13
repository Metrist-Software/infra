import Config

with {:unix, _} <- :os.type(),
     {id_and_release, 0} <- System.shell("lsb_release -sir"),
     [distribution, version] <- String.trim(id_and_release) |> String.split("\n"),
     distribution = String.downcase(distribution) do
  config :sup,
    distribution_name: distribution,
    distribution_version: version
end

if config_env() == :prod do
  launcher =
    case System.get_env("LAUNCH_TYPE", "docker") do
      "docker" -> Sup.Launcher.Docker
      "package" -> Sup.Launcher.Debian
      _ -> raise "Invalid LAUNCH TYPE. Options: docker, package"
    end

  config :sup,
    launcher: launcher
end
