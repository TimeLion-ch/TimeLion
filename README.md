![TimeLion Logo](public/assets/logo/logo_sm.png)
# TimeLion

TimeLion is a simple, open souce time scheduling tool.
It can be either self-hosted or freely used on [timelion.ch](https://timelion.ch)

# Prequisites
If you want to host TimeLion on your own hardware, you need to install the following tools:
- PHP (exact version needed can be found in the [composer file](composer.json))
- [Composer](https://getcomposer.org/)
- [Symfony](https://symfony.com/) (no need to install, since it's already part of this package)

# Installation
1. Copy the file `template.env` into a new file `.env`. Then, fill out all the asked information, including the database config.
2. Install all the dependencies:
	```bash
	~/TimeLion$ composer install
	```
3. Initialize the database:
	```bash
	~/TimeLion$ php bin/console make:migration
	~/TimeLion$ php bin/console doctrine:migrations:migrate
	```
