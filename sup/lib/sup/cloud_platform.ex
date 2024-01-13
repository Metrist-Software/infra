defmodule Sup.CloudPlatform do
  @moduledoc """
  This contains cloud-specific things around logging, load balancing, and whatnot. Pretty basic for now
  but we can grow as we go.
  """

  defmodule Implementation do
    @callback libcluster_topology() :: {atom(), keyword()} | nil
    @callback create_log_stream(String.t()) :: any()
    @callback logging_options(String.t()) :: String.t()
    @callback maybe_deregister_target() :: any()
    @callback maybe_register_target() :: any()
  end

  defmodule AWS do
    @behaviour Sup.CloudPlatform.Implementation
    require Logger

    @script_path "/var/run/sup"
    @start_redirect Path.join(@script_path, "start-redirect")
    @end_redirect   Path.join(@script_path, "end-redirect")

    @impl true
    def libcluster_topology() do
      {:ec2,
       [
         strategy: ClusterEC2.Strategy.Tags,
         config: [
           ec2_tagname: "cm-env-subsystem",
           ec2_tagvalue: "#{Sup.environment()}-#{Sup.subsystem()}",
           app_prefix: "sup",
           ip_type: :private,
           ip_to_nodename: &ip_to_nodename/2,
           polling_interval: 10_000,
           show_debug: false
         ]
       ]}
    end

    # To be multi-cloud/env compatible, we start Sup with `$(hostname f)`. We need to make
    # sure that we connect with the same names, so we need to do a reverse lookup (which works
    # fine on AWS)
    defp ip_to_nodename(list, app_prefix) when is_list(list) do
      list
      |> Enum.map(&resolve/1)
      |> Enum.map(fn ip ->
        :"#{app_prefix}@#{ip}"
      end)
    end
    defp resolve(ip_string) do
      case :inet.gethostbyaddr(String.to_charlist(ip_string)) do
        {:ok, {:hostent, hostname, _, _, _, _}} ->
          List.to_string(hostname)
        other ->
          ip_string
      end
     end

    @impl true
    def create_log_stream(container) do
      Sup.do_cmd(
        "aws logs create-log-stream --log-group-name #{log_group_name()} --log-stream-name #{log_stream_name(container)}"
      )
    end

    @impl true
    def logging_options(container) do
      """
      --log-driver=awslogs
      --log-opt awslogs-group=#{log_group_name()}
      --log-opt awslogs-stream=#{log_stream_name(container)}
      """
    end

    @impl true
    def maybe_deregister_target() do
      if alb_configured?() do
        redirect_target = random_other_node()

        # Maybe we should not hard-code port at some point but for now, it suffices. The forwarding
        # could also be setup on the system level, of course; it doesn't really make a big difference.
        iptables_start_redirect = """
          #!/usr/bin/env sh
          echo 1 >/proc/sys/net/ipv4/ip_forward
          iptables -t nat -A PREROUTING -p tcp --dport 4000 -j DNAT --to-destination #{redirect_target}:4000
          iptables -t nat -A POSTROUTING -j MASQUERADE -p tcp -d #{redirect_target} --dport 4000
          """
        iptables_end_redirect = String.replace(iptables_start_redirect, "-A", "-D")
        File.write!(@start_redirect, iptables_start_redirect)
        File.chmod(@start_redirect, 0o770)
        File.write!(@end_redirect, iptables_end_redirect)
        File.chmod(@end_redirect, 0o770)

        Sup.do_cmd(@start_redirect)
      end
    end

    @impl true
    def maybe_register_target() do
      if alb_configured?() do
        Sup.do_cmd(@end_redirect)
      end
    end

    defp random_other_node() do
      # We only have two nodes at the moment so this will always return the single
      # other node, but this makes it work in any case.
      {:ok, node_info} =
        :erlang.nodes()
        |> Enum.random()
        |> :net_kernel.node_info()
      {:net_address, {host, _port}, _name, :tcp, :inet} = node_info[:address]
      :inet.ntoa(host)
    end

    defp log_group_name, do: "#{Sup.environment()}-#{Sup.subsystem()}-logs"

    defp log_stream_name(container) do
      version =
        if String.contains?(container, "/") do
          container
          |> String.split("/")
          |> List.last()
        else
          container
        end

      """
      Note that Backend and Orchestrator instance_id have different values
      Backend - Instance ID of EC2 instance
      Orchestrator - <platform>:<environment>
      """
      "#{Sup.instance_id}/#{version}"
      |> String.replace(":", "-")
      |> String.replace("*", "-")
    end

    defp alb_configured?() do
      Sup.target_group_arn() != nil and Sup.instance_id() != nil
    end
  end

  defmodule GCP do
    @behaviour Sup.CloudPlatform.Implementation

    # If we run on GCP, we also send data to AWS Cloudwatch
    defdelegate create_log_stream(container), to: Sup.CloudPlatform.AWS
    defdelegate logging_options(container), to: Sup.CloudPlatform.AWS

    @impl true
    def libcluster_topology(), do: nil

    # Ignore for now as we are not lanning to run Backend or other web-reachable things on GCP
    @impl true
    def maybe_register_target(), do: :ok
    @impl true
    def maybe_deregister_target(), do: :ok
  end

  defmodule Azure do
    @behaviour Sup.CloudPlatform.Implementation

    # If we run on Azure, we also send data to AWS Cloudwatch
    defdelegate create_log_stream(container), to: Sup.CloudPlatform.AWS
    defdelegate logging_options(container), to: Sup.CloudPlatform.AWS

    @impl true
    def libcluster_topology(), do: nil

    # Ignore for now as we are not lanning to run Backend or other web-reachable things on Azure
    @impl true
    def maybe_register_target(), do: :ok
    @impl true
    def maybe_deregister_target(), do: :ok
  end

  defmodule None do
    @behaviour Sup.CloudPlatform.Implementation

    @impl true
    def create_log_stream(_container), do: :ok
    @impl true
    def logging_options(_container), do: ""

    @impl true
    def libcluster_topology(), do: nil

    @impl true
    def maybe_register_target(), do: :ok
    @impl true
    def maybe_deregister_target(), do: :ok
  end
end
