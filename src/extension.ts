import * as vscode from 'vscode';
let myStatusBarItem: vscode.StatusBarItem;
import axios, { AxiosResponse } from "axios";
import { JSDOM } from 'jsdom';

let currentLink: string;


type News = {
  title: string;
  description: string;
  link: string;
  date: Date;
  count: number;
};

let newsgroup: News[] = [];

async function loopbody(urls: [string, string][]) {
  // todo カウンターを入れて一度表示されたニュースは出てこないようにする
  let tempNewsgroup: News[] = [];
  var yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 6);
  let yesterdayNum = yesterday.getTime();
  for (let url of urls) {
    await axios.get(url[0])
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
          let provider: string = `(${url[1]})`;
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
                "date": japandate,
                "count": 0
              };
            };
            tempNewsgroup.push(news);
            console.log("getnews");
            console.log(news);
          } else {
          }
        });
      });
  }
  console.log(`updated. The number of news is ${tempNewsgroup.length}`);
  newsgroup = await JSON.parse(JSON.stringify(tempNewsgroup));
  return;
}

function showLatestNews() {
  // todo 非同期でデータが収集できるまで待つ
  if (newsgroup.length === 0) {
    let check = setInterval(() => {
      myStatusBarItem.text = `$(octoface) ` + `ニュース取得中...`;;
      myStatusBarItem.show();
      console.log("interval");
      if (newsgroup.length > 0) {
        clearInterval(check);
      }
    }, 100);
  }
  let filteredNewsgroup = newsgroup.filter(news => news.count === Math.min(...newsgroup.map((p) => p.count)));
  let selectedNews = filteredNewsgroup.find(news => 
    new Date(news.date).getTime() === Math.max(...filteredNewsgroup.map((p) => new Date(p.date).getTime()))
  );
  if (!selectedNews) {
    console.log("selectedNews not found");
    return;
  }
  console.log(`The number of filteredNewsgroup is ${filteredNewsgroup.length}`);
  console.log(selectedNews);
  let rssTitle: string;
  let rawtitle = selectedNews["title"];
  if (selectedNews["title"]) {
    rssTitle = `$(octoface) ` + selectedNews["title"];
  } else {
    rssTitle = `$(octoface) ` + `ニュース取得中...`;
  }
  const title = rssTitle ? rssTitle : "unknown";

  currentLink = selectedNews["link"];
  myStatusBarItem.text = title;
  myStatusBarItem.tooltip = selectedNews["description"];
  myStatusBarItem.name = "ニュース速報";
  myStatusBarItem.command = "vscode-NewsHeadline.openlink";
  myStatusBarItem.show();
  console.log("before count up");
  let idxUnfiltered = newsgroup.findIndex(news => news["title"] === rawtitle);
  if (idxUnfiltered === -1) {
    console.log("not found idxUnfiltered");
  } else {
    newsgroup[idxUnfiltered]["count"] += 1;
    console.log("count up");
  }
}

async function getLatestNews() {
  let urls: [string, string][] = [
    ["https://www.nhk.or.jp/rss/news/cat1.xml", "NHK"],
    ["https://www.nhk.or.jp/rss/news/cat3.xml", "NHK"],
    ["https://www.nhk.or.jp/rss/news/cat4.xml", "NHK"],
    ["https://www.nhk.or.jp/rss/news/cat5.xml", "NHK"],
    ["https://www.nhk.or.jp/rss/news/cat6.xml", "NHK"],
    ["https://news.yahoo.co.jp/rss/media/kyodonews/all.xml", "Y!"],
    ["https://news.yahoo.co.jp/rss/media/aptsushinv/all.xml", "Y!"],
    ["https://news.yahoo.co.jp/rss/media/rab/all.xml", "Y!"],
  ];

  await loopbody(urls);
};

export async function activate(context: vscode.ExtensionContext) {

  let disposable1 = vscode.commands.registerCommand('vscode-NewsHeadline.openlink', async () => {
    vscode.env.openExternal(vscode.Uri.parse(currentLink));
  });

  myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
  myStatusBarItem.text = `$(octoface) ニュース取得中...`;
  myStatusBarItem.show();
  getLatestNews();
  showLatestNews();
  setInterval(getLatestNews, 120_000);
  setInterval(showLatestNews, 30_000);

  context.subscriptions.push(disposable1);
  context.subscriptions.push(myStatusBarItem);
}

export function deactivate() { }
