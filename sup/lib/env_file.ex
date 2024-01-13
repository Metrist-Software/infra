defmodule Sup.EnvFile do
  @moduledoc """
  Expand references in an env file.

  Currently only supports `@ssm@:` for AWS System Manager parameter store values.
  """
  require Logger

  def expand(file_contents) do
    String.replace(file_contents, ~r|@ssm@:([A-Za-z0-9\+_/-]+)|, fn match ->
      [_ssm, name] = String.split(match, ":", limit: 2)
      Logger.debug("Expanding parameter #{name}")
      {:ok, response} =
        ExAws.SSM.get_parameter(name)
        |> Sup.aws_request()

      get_in(response, ["Parameter", "Value"])
    end)
    <> "\nRUN_FROM_SUP=1" # So containers know it's us
  end

  def expand_file(from, to) do
    Logger.debug("Expanding #{from} to #{to}")
    contents = File.read!(from)
    contents = expand(contents)
    File.write!(to, contents)
  end
end
