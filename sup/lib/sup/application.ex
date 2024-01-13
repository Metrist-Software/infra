defmodule Sup.Application do
  use Application
  require Logger

  def start(_type, _args) do
    Logger.info("=== SUP starting, subsystem=#{Sup.subsystem()}, production=#{Sup.production?()}")

    # Ensure our run state exists
    File.mkdir_p("/var/run/sup")

    # Suppress warnings from Libcluster - it's pretty much all from the EC2 strategy complaining that it
    # cannot reach the jump node where normally, no BEAM instance is running.
    Logger.put_module_level(Cluster.Logger, :error)

    topologies = [
      # Every little helps, and this will work in development too
      gossip: [
        strategy: Elixir.Cluster.Strategy.Gossip,
        config: [
          secret: "#{Sup.environment()}-#{Sup.subsystem()}-sup"
        ]
      ]
    ]

    topologies =
      case Sup.cloud_platform_module().libcluster_topology() do
        nil -> topologies
        t -> [t | topologies]
      end

    # In case of cluster trouble:
    # Application.put_env(:libcluster, :debug, true)

    children = [
      {Cluster.Supervisor, [topologies, [name: Sup.ClusterSupervisor]]},
      Sup.Poller
    ]

    opts = [strategy: :one_for_one, name: Sup.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
