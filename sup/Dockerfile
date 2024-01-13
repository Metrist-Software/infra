FROM canarymonitor/sup:build-base-2022.33 AS build

COPY mix.exs mix.lock ./
RUN mix do deps.get, deps.compile
COPY priv priv
COPY lib lib
COPY rel rel

RUN mix do compile, release

FROM canarymonitor/sup:runtime-base-2022.33 AS app

COPY --from=build /app/_build/prod/rel/sup ./

CMD ["bin/sup", "start"]
