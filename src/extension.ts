import * as vscode from 'vscode';
let myStatusBarItem: vscode.StatusBarItem;
import axios, { AxiosResponse } from "axios";
import { JSDOM } from 'jsdom';

let currentHeadline: string;

interface News {
  [attr: string]: string
}

let newsgroup: News[] = [{}];

async function loopbody(urls: string[]) {
  // todo カウンターを入れて一度表示されたニュースは出てこないようにする
  let tempNewsgroup: News[] = [{}];
  var yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 6);
  let yesterdayNum = yesterday.getTime();
  for (let url of urls) {
    await axios.get(url)
      .then(async (res: AxiosResponse<string>) => {
        const jsdom = new JSDOM();
        const parser = new jsdom.window.DOMParser();
        const doc = parser.parseFromString(await res["data"], "text/xml");
        doc.documentElement.querySelectorAll("item").forEach((item) => {
          let pubdate = item.querySelector("pubDate");
          if (!pubdate) { return; };
          let title = item.querySelector("title");
          if (!title) { return; };
          if (!pubdate.textContent) { return; };
          let datestring = pubdate.textContent;
          if (!title.textContent) { return; };
          let date = new Date(datestring);
          let utcdate = new Date(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds()
          );
          let japandate = new Date(utcdate);
          japandate.setHours(japandate.getHours() + 9);

          let description = item.querySelector("description")?.textContent;
          let link: string | null | undefined;
          let provider: string = "(NHK)";
          link = item.querySelector("link")?.textContent;

          let content = `${title.textContent} ${provider}(${japandate.getDate()}日${japandate.getHours()}:${('00' + japandate.getMinutes()).slice(-2)})`;

          if (title && description && link && japandate.getTime() > yesterdayNum) {
            let news: News = {
              "title": content,
              "description": description,
              "link": link
            };
            tempNewsgroup.push(news);
          } else {
            console.log("err");
          }
        });
      });
  }
  console.log("update");
  newsgroup = await JSON.parse(JSON.stringify(tempNewsgroup));
  return;
}

async function showLatestNews() {
  let idx = Math.floor(Math.random() * newsgroup.length);
  let rssTitle: string;
  // todo 非同期でデータが収集できるまで待つ
  if (newsgroup[idx]["title"]) {
    rssTitle = `$(octoface) ` + newsgroup[idx]["title"];
  } else {
    rssTitle = `$(octoface) ` + `ニュース取得中...`;
  }
  const title = rssTitle ? rssTitle : "unknown";

  currentHeadline = newsgroup[idx]["link"];
  myStatusBarItem.text = title;
  myStatusBarItem.tooltip = newsgroup[idx]["description"];
  myStatusBarItem.name = "ニュース速報";
  myStatusBarItem.command = "vscode-NewsHeadline.openlink";
  myStatusBarItem.show();
}

async function getLatestNews() {
  let urls: string[] = [
    "https://www.nhk.or.jp/rss/news/cat1.xml",
    "https://www.nhk.or.jp/rss/news/cat3.xml",
    "https://www.nhk.or.jp/rss/news/cat4.xml",
    "https://www.nhk.or.jp/rss/news/cat5.xml",
    "https://www.nhk.or.jp/rss/news/cat6.xml",
  ];

  await loopbody(urls);
};

export async function activate(context: vscode.ExtensionContext) {

  let disposable1 = vscode.commands.registerCommand('vscode-NewsHeadline.openlink', async () => {
    vscode.env.openExternal(vscode.Uri.parse(currentHeadline));
  });

  myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
  myStatusBarItem.text = `$(octoface) ニュース取得中...`;
  myStatusBarItem.show();
  await getLatestNews();
  showLatestNews();
  setInterval(getLatestNews, 600000);
  setInterval(showLatestNews, 30000);

  context.subscriptions.push(disposable1);
  context.subscriptions.push(myStatusBarItem);
}

export function deactivate() { }
