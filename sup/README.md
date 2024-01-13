# SUP

Simple Upgrade Process

This gets run as a privileged docker container from startup on worker nodes, with as argument what
to run. The simple upgrade process is then:

* Poll `latest.txt` from an S3 bucket every ~5 seconds
* If it is newer, pull container
* Kill current container
* Start new container

Runs as docker so that we can use Docker itself to distribute this code so we don't need to
bootstrap anything but:

```
docker run --restart unless-stopped <other args> this-container:latest
```

Where "<other args>" make the thing privileged, like mounting the docker socket.

Note that for private repositories, the EC2 instance needs to have access rights (through its instance role).

## Container start

This is purely 12FA - a `/var/lib/sup/<service>.env` file is supposed to be there and will
be injected. The container is run on the host network so can do whatever it wants. Again, any AWS specific
grants should be on the EC2 instance.

## Clustering

Erlang clustering is cheap and we already use it. SUP will cluster up and make sure only
one process at a time runs the upgrade. This way, we can have rolling upgrades.
