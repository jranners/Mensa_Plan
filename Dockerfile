FROM nginx:alpine

# Copy static files to Nginx web root
COPY . /usr/share/nginx/html/

# Ensure secure file permissions
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
