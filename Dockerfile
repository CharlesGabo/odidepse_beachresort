FROM php:8.2-apache

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Copy everything directly into the Apache web root
# Render will use this exactly like your XAMPP environment
COPY . /var/www/html/

EXPOSE 80
