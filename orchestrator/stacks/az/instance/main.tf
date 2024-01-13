resource "azurerm_resource_group" "main" {
  name     = local.prefix
  location = var.region
}

resource "azurerm_virtual_network" "main" {
  name                = local.prefix
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_subnet" "main" {
  name                 = local.prefix
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.0.0/24"]
}


resource "azurerm_network_security_group" "main" {
  name                = local.prefix
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "allow-all-outbound"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}


resource "azurerm_network_interface" "main" {
  name                = local.prefix
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.main.id
    private_ip_address_allocation = "Dynamic"
  }
}

resource "azurerm_subnet_network_security_group_association" "main" {
  subnet_id                 = azurerm_subnet.main.id
  network_security_group_id = azurerm_network_security_group.main.id
}

resource "azurerm_network_interface_security_group_association" "main" {
  network_interface_id      = azurerm_network_interface.main.id
  network_security_group_id = azurerm_network_security_group.main.id
}

data "aws_cloudwatch_log_group" "logs" {
  # Name must match what Sup expects and what we have in infra
  name = "${var.env}-orchestrator-logs"
}

module "orchestrator_user" {
  source   = "../../../modules/orchestrator_user"
  env      = var.env
  region   = var.region
  platform = "az"
  logs_arn = data.aws_cloudwatch_log_group.logs.arn
}

module "init_script" {
  source                = "../../../modules/cloudinit_script"
  env                   = var.env
  region                = var.region
  aws_region            = local.aws_region
  platform              = "az"
  aws_access_key_id     = module.orchestrator_user.aws_access_key_id
  aws_secret_access_key = module.orchestrator_user.aws_secret_access_key
}

resource "random_password" "main" {
  length  = 16
  special = false
  min_lower = 1
  min_upper = 1
  min_numeric = 1
}

resource "aws_secretsmanager_secret" "main" {
  # Not super clean, but .../region is already taken.
  name = "/${var.env}/orchestrator/az/${var.region}-adminuser"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "main" {
  secret_id = aws_secretsmanager_secret.main.id
  secret_string = jsonencode({
    admin_username = "adminuser"
    admin_password = random_password.main.result
  })
}

resource "azurerm_linux_virtual_machine" "main" {
  name                            = local.prefix
  resource_group_name             = azurerm_resource_group.main.name
  location                        = azurerm_resource_group.main.location
  size                            = "Standard_F1"
  admin_username                  = "adminuser"
  admin_password                  = random_password.main.result
  custom_data                     = base64encode(module.init_script.script)
  disable_password_authentication = false

  network_interface_ids = [
    azurerm_network_interface.main.id,
  ]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "UbuntuServer"
    sku       = "18.04-LTS"
    version   = "latest"
  }
}
