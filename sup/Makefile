.PHONY: dev run db.reset

dev:
	mix deps.get

run:
    # Note that this will run aganst wherever your AWS... env vars are pointed at
	iex -S mix

release:
	mkdir -p priv/
	echo Revision: `git rev-parse --short HEAD` >priv/build.txt
	echo Date: `date` >>priv/build.txt
	echo Build-Host: `hostname` >>priv/build.txt
	MIX_ENV=prod mix do compile, release --overwrite

package: release
	export version=`cat _build/prod/rel/sup/releases/start_erl.data |awk '{print $$2}')` \
	tag=`git rev-parse --short HEAD)`; \
	fpm --verbose -t deb \
	  -s dir \
	  -n metrist-sup \
	  -v $$version-ubuntu-20.04-$$tag \
	  --provides metrist-sup \
	  _build/prod/rel/sup=/opt \
	  _build/prod/rel/sup/sup.service=/etc/systemd/system/metrist-sup.service


local_release:
	MIX_ENV=prod mix do compile, release --overwrite

test_push: release
	./build-and-push.sh
	@echo To run this release, use ../bin/jump_on.sh to jump on a host in staging
	@echo and execute:
	@echo
	@echo   "cat /usr/local/bin/supgrade | sed s/latest/`git rev-parse --short HEAD`/g | bash"
	@echo
	@echo to run this version of Sup.
	@echo
	@echo

push: release
	./build-and-push.sh --with-latest
	@echo To activate this release, either re-roll infra or manually run 'supgrade'
	@echo on target hosts.
	@echo
