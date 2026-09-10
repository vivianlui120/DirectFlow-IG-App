const puppeteer = require('puppeteer-core')
const fs = require('fs')
const os = require('os')
const path = require('path')

//获取系统Edge路径
exports.getSystemEdgePath = function(){
  if(os.platform()==='win32'){
    return `C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe`
  }
  return ""
}

//启动浏览器实例，独立代理
exports.launchInstance = async function(config){
  const exePath = exports.getSystemEdgePath()
  if(!fs.existsSync(exePath)) throw new Error("未找到系统Edge浏览器")

  const args = []
  //代理参数
  if(config.proxyIp && config.proxyPort){
    args.push(`--proxy-server=http://${config.proxyIp}:${config.proxyPort}`)
  }

  const launchOpt = {
    executablePath:exePath,
    headless: config.headless ? "new":false,
    args:args,
    defaultViewport:null
  }

  const browser = await puppeteer.launch(launchOpt)
  const page = await browser.newPage()

  if(config.ua) await page.setUserAgent(config.ua)

  //打开IG登录页
  await page.goto("https://www.instagram.com/")

  //本地存储session，后续可做cookie保存
  console.log(`实例[${config.instName}]已启动 IG账号:${config.igUser}`)
  return {browser,page}
}
