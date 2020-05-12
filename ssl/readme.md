CSR файл и приватный ключ получены командой:
```
openssl req -new -newkey rsa:2048 -nodes -keyout gdmn.app.key -out gdmn.app.csr
```
сюда надо подложить файлы сертификатов:

1. gdmn.app.csr
1. gdmn.app.key
1. star.gdmn.app.ca-bundle
1. star.gdmn.app.crt
1. star.gdmn.app.p7b

