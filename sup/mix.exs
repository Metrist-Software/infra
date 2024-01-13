defmodule Sup.MixProject do
  use Mix.Project

  def project do
    [
      app: :sup,
      version: "0.1.0",
      elixir: "~> 1.11",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      extra_applications: [:logger, :os_mon],
      mod: {Sup.Application, []}
    ]
  end

  # Run "mix help deps" to learn about dependencies.
  defp deps do
    [
      {:dialyxir, "~> 1.0", only: [:dev, :test], runtime: false},
      {:ex_aws, "~> 2.1"},
      {:ex_aws_s3, "~> 2.0"},
      {:ex_aws_ssm, "~> 2.0"},
      {:yaml_elixir, "~> 2.8"},
      {:configparser_ex, "~> 4.0"},
      {:ex_aws_elastic_load_balancing, "~> 2.0"},
      {:hackney, "~> 1.9"},
      {:httpoison, "~> 1.8"},
      {:jason, "~> 1.2"},
      {:libcluster, "~> 3.3"},
      {:libcluster_ec2, "~> 0.6.0"}
    ]
  end
end
