import * as vscode from 'vscode';
let myStatusBarItem: vscode.StatusBarItem;
import axios, { AxiosResponse } from "axios";
import { JSDOM } from 'jsdom';

let currentHeadline: string;


type News = {
  title: string;
  description: string;
  link: string;
  count: number;
};

let newsgroup: News[] = [];

async function loopbody(urls: string[]) {
  // todo カウンターを入れて一度表示されたニュースは出てこないようにする
  let tempNewsgroup: News[] = [];
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
            let foundnews = newsgroup.find(news => news.title === content);
            let news;
            if (foundnews) {
              news = JSON.parse(JSON.stringify(foundnews));
            } else {
              news = {
                "title": content,
                "description": description,
                "link": link,
                "count": 0
              };
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
  // todo 非同期でデータが収集できるまで待つ
  let check = setInterval(() => {
    if (newsgroup.length > 0) {
      clearInterval(check);
    }
  }, 100);
  let filteredNewsgroup = newsgroup.filter(news => news.count === Math.min(...newsgroup.map((p) => p.count)));
  let idx = Math.floor(Math.random() * filteredNewsgroup.length);
  let rssTitle: string;
  if (filteredNewsgroup[idx]["title"]) {
    rssTitle = `$(octoface) ` + filteredNewsgroup[idx]["title"];
  } else {
    rssTitle = `$(octoface) ` + `ニュース取得中...`;
  }
  const title = rssTitle ? rssTitle : "unknown";

  currentHeadline = filteredNewsgroup[idx]["link"];
  myStatusBarItem.text = title;
  myStatusBarItem.tooltip = filteredNewsgroup[idx]["description"];
  myStatusBarItem.name = "ニュース速報";
  myStatusBarItem.command = "vscode-NewsHeadline.openlink";
  myStatusBarItem.show();
  newsgroup[idx]["count"] += 1;
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
  setInterval(getLatestNews, 60_000);
  setInterval(showLatestNews, 10_000);

  context.subscriptions.push(disposable1);
  context.subscriptions.push(myStatusBarItem);
}

export function deactivate() { }
