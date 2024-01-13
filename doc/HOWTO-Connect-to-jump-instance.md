# How to Connect to Jump Instance

Jump instance is an EC2 instance we use to connect to private resources. They're usually named as `<env>-backend-jump` and we use [EC2 Instance Connect](https://aws.amazon.com/blogs/compute/new-using-amazon-ec2-instance-connect-for-ssh-access-to-your-ec2-instances/) to connect to it.

To connect, you can either use the [browser-based client](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-connect-methods.html#ec2-instance-connect-connecting-console) or send your public keys to the instance by running

```shell
aws ec2-instance-connect send-ssh-public-key \
    --instance-id <isntance_id>  \
    --availability-zone <instance_az> \
    --instance-os-user ec2-user \
    --ssh-public-key file://<your_public_key>.pub


# Then ssh it to it
ssh -i <private_key> ubuntu@<ip or hostname>

# Or if you added your SSH key to the ssh-agent
ssh ubuntu@<ip or hostname>
```

As it is a bit of a hassle to figure out instance IDs and the actual backends are not directly accessible from the public
Internet, meaning that you have to jump through the jump host, [a script](../bin/jump-on.sh) is provided to make things
easy. Please see the script source for details.
