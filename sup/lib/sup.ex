defmodule Sup do
  require Logger

  def qualifier do
    if production?() do
      ""
    else
      "-preview"
    end
  end

  def subsystem do
    System.get_env("SUP_SUBSYSTEM") || raise "Subsystem not set!"
  end

  def production? do
    case System.get_env("ENVIRONMENT_TAG") do
      nil -> false
      env -> String.starts_with?(env, "prod")
    end
  end

  def environment do
    System.get_env("ENVIRONMENT_TAG") || "dev-#{System.get_env("USER")}"
  end

  def aws_region do
    System.get_env("AWS_REGION") || "local-dev"
  end

  def target_group_arn do
    System.get_env("TARGET_GROUP_ARN")
  end

  def instance_id do
    System.get_env("INSTANCE_ID")
  end

  def cloud_platform do
    System.get_env("CLOUD_PLATFORM") || "aws"
  end

  def cloud_platform_module(), do: cloud_platform_module(cloud_platform())
  def cloud_platform_module("aws"), do: Sup.CloudPlatform.AWS
  def cloud_platform_module("gcp"), do: Sup.CloudPlatform.GCP
  def cloud_platform_module("az"), do: Sup.CloudPlatform.Azure
  def cloud_platform_module(other) do
    Logger.warn("No Cloud platform configured or unknown cloud platform [#{other}]")
    Sup.CloudPlatform.None
  end

  def aws_request(request) do
    ExAws.request(request, region: aws_region())
  end


  def do_cmd(cmd, args) do
    {out, status} = System.cmd(cmd, args, stderr_to_stdout: true)
    case status do
      0 ->
        Logger.info("Command #{cmd} #{inspect args} output: #{out}")
        :ok
      err ->
        Logger.warn("Command #{cmd} #{inspect args} exited with non-zero status #{err}.\nOutput: #{out}")
        :error
    end
  end
  def do_cmd(cmd) do
    [c | rest] = String.split(cmd)
    do_cmd(c, rest)
  end
 end
