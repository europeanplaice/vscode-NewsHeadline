import * as vscode from 'vscode';
let myStatusBarItem: vscode.StatusBarItem;
import axios, { AxiosResponse } from "axios";
import { JSDOM } from 'jsdom';
var utils = require('./utils');

let currentLink: string;

type News = {
  title: string;
  description: string;
  link: string;
  date: Date;
  count: number;
  priority: number;
  lastRead: Date | null;
};

type SourceInfo = {
  url: string;
  priority: number;
};

let newsgroup: News[] = [];

async function loopbody(sourceinfos: SourceInfo[]) {
  var dateThreshold = new Date();
  dateThreshold.setHours(dateThreshold.getHours() - 6);
  let dateThresholdNum = dateThreshold.getTime();
  for (let sourceinfo of sourceinfos) {
    await axios.get(sourceinfo.url)
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
          let localdate = new Date(utcdate);
          localdate.setMinutes(localdate.getMinutes() - new Date().getTimezoneOffset());

          let description = item.querySelector("description")?.textContent;
          description = description ? description : "";
          let link: string | null | undefined;
          link = item.querySelector("link")?.textContent;

          let content = `${title.textContent.slice(0, 40)} (${localdate.getHours()}:${('00' + localdate.getMinutes()).slice(-2)} ${new Intl.DateTimeFormat('en-US', { month: 'short'}).format(localdate)} ${localdate.getDate()})`;

          if (title && link && localdate.getTime() > dateThresholdNum) {
            let foundnews = newsgroup.find(news => news.title === content);
            if (foundnews) {
            } else {
              let news: News = {
                "title": content,
                "description": description,
                "link": link,
                "date": localdate,
                "priority": sourceinfo.priority,
                "count": 0,
                "lastRead": null
              };
              newsgroup.push(news);
            };
            console.log("getnews");
          } else {
          }
        });
      });
  }
  newsgroup = newsgroup.filter(news => news.date.getTime() > dateThresholdNum);
  console.log(`updated. The number of news is ${newsgroup.length}`);
  return;
}

async function transition(lastnewsTitle: string, latestnewsTitle: string) {
  const wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  let lastnewsTitleLength = lastnewsTitle.length;
  let latestnewsTitleLength = latestnewsTitle.length;
  for (let i = 0; i < latestnewsTitleLength; i++) {
    let transitionStr = lastnewsTitle.slice(i, i + lastnewsTitleLength) + latestnewsTitle.slice(0, i);
    myStatusBarItem.text = transitionStr;
    await wait(Math.min(0.01+i*0.5, 25));
    myStatusBarItem.show();
  }
  myStatusBarItem.text = latestnewsTitle;
  myStatusBarItem.show();
}

function showLatestNews() {
  // todo 非同期でデータが収集できるまで待つ
  new Promise<void>((resolve) => {
    if (newsgroup.length === 0) {
      let check = setInterval(() => {
        myStatusBarItem.text = `$(octoface) ` + `ニュース取得中...`;
        myStatusBarItem.show();
        console.log("interval");
        if (newsgroup.length > 0) {
          console.log("news found after wait " + newsgroup.length);
          clearInterval(check);
          resolve();
        }
      }, 100);
    } else {
      resolve();
    }
  }).then(() => {
    let filteredNewsgroup = newsgroup.filter(news => news.count === Math.min(...newsgroup.map((p) => p.count)));
    filteredNewsgroup = filteredNewsgroup.filter(news => news.priority === Math.min(...filteredNewsgroup.map((p) => p.priority)));
    let selectedNews: News | undefined;
    if (filteredNewsgroup.length > 0 && filteredNewsgroup[0].count > 0) {
      // 二週目以降は最後に読まれた時間が一番遅い記事を表示する
      selectedNews = filteredNewsgroup.find(news => 
        new Date(news.lastRead ? news.lastRead : "").getTime() === Math.min(...filteredNewsgroup.map((p) => new Date(p.lastRead ? p.lastRead : "").getTime()))
      );
    } else {
      selectedNews = filteredNewsgroup.find(news => 
        new Date(news.date).getTime() === Math.max(...filteredNewsgroup.map((p) => new Date(p.date).getTime()))
      );
    }
    if (!selectedNews) {
      console.log("selectedNews not found");
      return;
    }
    console.log(`The number of filteredNewsgroup is ${filteredNewsgroup.length}`);
    console.log(selectedNews.title, selectedNews.date, selectedNews.count);
    let rssTitle: string;
    let rawtitle = selectedNews["title"];
    let icon: string = `$(octoface) `;
    if (selectedNews["count"] === 0) {
      icon = `$(zap) `;
    } else {
      icon = `$(octoface) `;
    }
    if (selectedNews["title"]) {
      rssTitle = icon + selectedNews["title"];
    } else {
      rssTitle = icon + `ニュース取得中...`;
    }
    var title = rssTitle ? rssTitle : "unknown";
  
    title = title.replace(" (Reuters Japan) ", "");
    title = title.replace("(共同通信)", "(共同)");
    title = title.replace("　", " ");
    title = title.replace("、", ",");
    title = utils.Zenkaku2hankaku(title);
    title = utils.zenkana2Hankana(title);
  
    currentLink = selectedNews["link"];
    transition(myStatusBarItem.text, title);
    myStatusBarItem.text = title;
    myStatusBarItem.tooltip = selectedNews["description"];
    myStatusBarItem.name = "ニュース速報";
    myStatusBarItem.command = "vscode-NewsHeadline.openlink";
  
    var thirtyminutes = new Date();
    thirtyminutes.setMinutes(thirtyminutes.getMinutes() - 30);
    var sixtyminutes = new Date();
    sixtyminutes.setMinutes(sixtyminutes.getMinutes() - 60);
  
    if (selectedNews["date"].getTime() > thirtyminutes.getTime()) {
      myStatusBarItem.backgroundColor =
        new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (selectedNews["date"].getTime() > sixtyminutes.getTime()){
      myStatusBarItem.backgroundColor =
        new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      myStatusBarItem.backgroundColor = undefined;
    }
    myStatusBarItem.show();
    console.log("before count up");
    let idxUnfiltered = newsgroup.findIndex(news => news["title"] === rawtitle);
    if (idxUnfiltered === -1) {
      console.log("not found idxUnfiltered");
    } else {
      newsgroup[idxUnfiltered]["count"] += 1;
      newsgroup[idxUnfiltered]["lastRead"] = new Date();
      console.log("count up");
    }
  });
}

async function getLatestNews() {
  const configUrls: string[] | undefined = vscode.workspace.getConfiguration('vscode-NewsHeadline').get("newsSource");
  if (!configUrls) {
    return;
  }
  let urls: SourceInfo[] = [];
  for (let configUrl of configUrls) {
    urls.push({
      url: configUrl,
      priority: 1,
    });
  }

  await loopbody(urls);
};

export async function activate(context: vscode.ExtensionContext) {

  let disposable1 = vscode.commands.registerCommand('vscode-NewsHeadline.openlink', async () => {
    vscode.env.openExternal(vscode.Uri.parse(currentLink));
  });

  myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  myStatusBarItem.text = `$(octoface) ニュース取得中...`;
  myStatusBarItem.show();
  getLatestNews();
  showLatestNews();
  setInterval(getLatestNews, 180_000);
  setInterval(showLatestNews, 30_000);

  context.subscriptions.push(disposable1);
  context.subscriptions.push(myStatusBarItem);
}

export function deactivate() { }
