# Public Static Files

把微信公众平台下载的域名校验文件放在这个目录里。

例如微信下载的文件名是：

```text
MP_verify_xxxxxxxxxxxxxxxx.txt
```

就把它放成：

```text
public/MP_verify_xxxxxxxxxxxxxxxx.txt
```

服务启动后，确保可以通过下面的公网地址访问：

```text
https://你的域名/MP_verify_xxxxxxxxxxxxxxxx.txt
```

