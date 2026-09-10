/**
 * Socks5 本地代理转发
 * 在本地启动一个 HTTP 代理服务器，把请求转发到 Socks5 代理
 * 解决 Chrome --proxy-server 不支持 Socks5 带认证的问题
 */
const net = require('net');
const { SocksClient } = require('socks');

class Socks5HttpProxy {
  constructor(socksHost, socksPort, socksUser, socksPass) {
    this.socksHost = socksHost;
    this.socksPort = socksPort;
    this.socksUser = socksUser;
    this.socksPass = socksPass;
    this.server = null;
    this.port = 0;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((clientSocket) => {
        this.handleClient(clientSocket);
      });
      this.server.on('error', (err) => {
        console.error(`[socks-proxy] 服务器错误: ${err.message}`);
      });
      this.server.listen(0, '127.0.0.1', () => {
        this.port = this.server.address().port;
        console.log(`[socks-proxy] 本地HTTP代理启动: 127.0.0.1:${this.port} -> socks5://${this.socksHost}:${this.socksPort}`);
        resolve(this.port);
      });
    });
  }

  handleClient(clientSocket) {
    let buffer = Buffer.alloc(0);
    let connected = false;

    clientSocket.on('data', async (chunk) => {
      if (connected) return;
      buffer = Buffer.concat([buffer, chunk]);
      const dataStr = buffer.toString();

      // 处理 CONNECT 请求（HTTPS）
      if (dataStr.startsWith('CONNECT')) {
        const match = dataStr.match(/CONNECT ([^:\s]+):(\d+)/);
        if (match) {
          connected = true;
          await this.handleConnect(clientSocket, match[1], parseInt(match[2]));
        }
        return;
      }

      // 处理普通 HTTP 请求
      const match = dataStr.match(/^[A-Z]+ http:\/\/([^\/\s]+)(\/[^\s]*)?/);
      if (match) {
        connected = true;
        const hostPort = match[1].split(':');
        const host = hostPort[0];
        const port = hostPort[1] ? parseInt(hostPort[1]) : 80;
        await this.handleHttp(clientSocket, host, port, buffer);
      }
    });

    clientSocket.on('error', () => {});
  }

  async handleConnect(clientSocket, host, port) {
    try {
      const proxyConfig = {
        host: this.socksHost,
        port: parseInt(this.socksPort),
        type: 5,
      };
      if (this.socksUser) proxyConfig.userId = this.socksUser;
      if (this.socksPass) proxyConfig.password = this.socksPass;

      console.log(`[socks-proxy] 连接Socks5: ${this.socksHost}:${this.socksPort} -> ${host}:${port} (user=${this.socksUser ? '有' : '无'})`);

      const options = {
        proxy: proxyConfig,
        command: 'connect',
        destination: { host, port },
        timeout: 60000,
      };

      const { socket: remoteSocket } = await SocksClient.createConnection(options);
      console.log(`[socks-proxy] 连接成功: ${host}:${port}`);
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

      clientSocket.pipe(remoteSocket);
      remoteSocket.pipe(clientSocket);

      clientSocket.on('close', () => { try { remoteSocket.destroy(); } catch(e) {} });
      remoteSocket.on('close', () => { try { clientSocket.destroy(); } catch(e) {} });
      clientSocket.on('error', () => { try { remoteSocket.destroy(); } catch(e) {} });
      remoteSocket.on('error', () => { try { clientSocket.destroy(); } catch(e) {} });
    } catch (e) {
      const errMsg = e.message || e.toString() || '未知错误';
      console.error(`[socks-proxy] CONNECT ${host}:${port} 失败: ${errMsg}`);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.end();
    }
  }

  async handleHttp(clientSocket, host, port, initialData) {
    try {
      const options = {
        proxy: {
          host: this.socksHost,
          port: parseInt(this.socksPort),
          type: 5,
          userId: this.socksUser,
          password: this.socksPass,
        },
        command: 'connect',
        destination: { host, port: parseInt(port) },
        timeout: 60000,
      };

      const { socket: remoteSocket } = await SocksClient.createConnection(options);
      remoteSocket.write(initialData);

      clientSocket.pipe(remoteSocket);
      remoteSocket.pipe(clientSocket);

      clientSocket.on('close', () => { try { remoteSocket.destroy(); } catch(e) {} });
      remoteSocket.on('close', () => { try { clientSocket.destroy(); } catch(e) {} });
      clientSocket.on('error', () => { try { remoteSocket.destroy(); } catch(e) {} });
      remoteSocket.on('error', () => { try { clientSocket.destroy(); } catch(e) {} });
    } catch (e) {
      console.error(`[socks-proxy] HTTP ${host}:${port} 失败: ${e.message}`);
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      clientSocket.end();
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

module.exports = Socks5HttpProxy;
