CSR файл и приватный ключ получены командой:
```
openssl req -new -newkey rsa:2048 -nodes -keyout gdmn.app.key -out gdmn.app.csr
```
сюда надо подложить файлы сертификатов:

1. gdmn.app.crt
1. gdmn.app.key
1. gdmn.app.ca-bundle
