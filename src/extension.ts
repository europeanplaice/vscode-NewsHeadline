import * as vscode from 'vscode';
let myStatusBarItem: vscode.StatusBarItem;
import axios, { AxiosResponse } from "axios";
import { JSDOM } from 'jsdom';
var utils = require('./utils');

let currentLink: string;
let showlength: number;

type FullTitle = {
  icon: string,
  title: string,
  dateInfo: string
};

function renderFullTitle(fulltitle: FullTitle) {
  return `${fulltitle.icon}${fulltitle.title} ${fulltitle.dateInfo}`;
}

type News = {
  title: string;
  description: string;
  link: string;
  localdate: Date;
  count: number;
  priority: number;
  source: string;
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
        const doc = parser.parseFromString(res["data"], "text/xml");
        doc.documentElement.querySelectorAll("item").forEach((item) => {
          let pubdate = item.querySelector("pubDate");
          if (!pubdate) { return; };
          let title = item.querySelector("title");
          if (!title) { return; };
          let titleString = title.textContent;
          if (!titleString) { return; };
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

          if (title && link && localdate.getTime() > dateThresholdNum) {
            let foundnews = newsgroup.find(news => news.title === titleString);
            if (foundnews) {
            } else {
              let news: News = {
                "title": title.textContent,
                "description": description,
                "link": link,
                "localdate": localdate,
                "priority": sourceinfo.priority,
                "count": 0,
                "source": sourceinfo.url,
                "lastRead": null
              };
              newsgroup.push(news);
            };
          } else {
          }
        });
      });
  }
  newsgroup = newsgroup.filter(news => news.localdate.getTime() > dateThresholdNum);
  newsgroup = newsgroup.filter(news => vscode.workspace.getConfiguration('newsheadlines').newsSource.includes(news.source));
  return;
}

async function longTitleMove(fulltitle: FullTitle) {
  let fullTitleString = fulltitle.title;
  const wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  let movingFlag = " ";
  let shortMovie = " ".repeat(showlength - movingFlag.length) + movingFlag + fullTitleString; // figure space
  for (let i = 0; i < showlength + movingFlag.length; i++) {
    myStatusBarItem.text = renderFullTitle({
      icon: fulltitle.icon,
      title: shortMovie.slice(i, i + showlength),
      dateInfo: fulltitle.dateInfo,
    });
    await wait(10);
  }
  for (let i = 0; i < fullTitleString.length - showlength + 2; i++) {
    let transitionStr = fullTitleString.slice(i, i + showlength);
    fulltitle.title = transitionStr;
    myStatusBarItem.text = renderFullTitle(fulltitle);
    myStatusBarItem.show();
    await wait(100);
    if (i === 0) {
      await wait(15000);
    }
  }
  myStatusBarItem.text = renderFullTitle(fulltitle);
  myStatusBarItem.show();
}

function showLatestNews() {
  new Promise<void>((resolve) => {
    if (newsgroup.length === 0) {
      let check = setInterval(() => {
        myStatusBarItem.text = `$(octoface) ` + `Initializing...`;
        myStatusBarItem.show();
        if (newsgroup.length > 0) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    } else {
      resolve();
    }
  }).then(() => {
    showlength = Math.max(vscode.workspace.getConfiguration('newsheadlines').length, 20);
    let filteredNewsgroup = newsgroup.filter(news => news.count === Math.min(...newsgroup.map((p) => p.count)));
    filteredNewsgroup = filteredNewsgroup.filter(news => news.priority === Math.min(...filteredNewsgroup.map((p) => p.priority)));
    let selectedNews: News | undefined;
    if (filteredNewsgroup.length > 0 && filteredNewsgroup[0].count > 0) {
      selectedNews = filteredNewsgroup.find(news =>
        new Date(news.lastRead ? news.lastRead : "").getTime() === Math.min(...filteredNewsgroup.map((p) => new Date(p.lastRead ? p.lastRead : "").getTime()))
      );
    } else {
      selectedNews = filteredNewsgroup.find(news =>
        new Date(news.localdate).getTime() === Math.max(...filteredNewsgroup.map((p) => new Date(p.localdate).getTime()))
      );
    }
    if (!selectedNews) {
      return;
    }
    let icon: string = `$(octoface) `;
    if (selectedNews["count"] === 0) {
      icon = `$(zap) `;
    } else {
      icon = `$(octoface) `;
    }

    let rawtitle: string;
    if (selectedNews["title"]) {
      rawtitle = selectedNews["title"];
    } else {
      rawtitle = `News collecting...`;
    }

    let title = rawtitle;
    let localdate = selectedNews["localdate"];
    let dateInfo = `(${localdate.getHours()}:${('00' + localdate.getMinutes()).slice(-2)} ${new Intl.DateTimeFormat('en-US', { month: 'short' }).format(localdate)} ${localdate.getDate()})`;

    title = title.replace("　", " ");
    title = title.replace("、", ",");
    title = utils.Zenkaku2hankaku(title);
    title = utils.zenkana2Hankana(title);

    let fulltitle: FullTitle = {
      icon: icon,
      title: title,
      dateInfo: dateInfo
    };

    currentLink = selectedNews["link"];
    myStatusBarItem.tooltip = new vscode.MarkdownString(selectedNews["description"]);
    myStatusBarItem.name = "News Headlines";
    myStatusBarItem.command = "newsheadlines.openlink";
    myStatusBarItem.show();
    longTitleMove(fulltitle);

    let idxUnfiltered = newsgroup.findIndex(news => news["title"] === rawtitle);
    if (idxUnfiltered === -1) {
    } else {
      newsgroup[idxUnfiltered]["count"] += 1;
      newsgroup[idxUnfiltered]["lastRead"] = new Date();
    }
  });
}

async function getLatestNews() {
  const configUrls: string[] | undefined = vscode.workspace.getConfiguration('newsheadlines').get("newsSource");
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

  let disposable1 = vscode.commands.registerCommand('newsheadlines.openlink', async () => {
    vscode.env.openExternal(vscode.Uri.parse(currentLink));
  });

  myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  myStatusBarItem.text = `$(octoface) Initializing...`;
  myStatusBarItem.show();
  getLatestNews();
  showLatestNews();
  setInterval(getLatestNews, 180_000);
  setInterval(showLatestNews, Math.max(vscode.workspace.getConfiguration('newsheadlines').showIntervalSeconds * 1000), 30000);

  context.subscriptions.push(disposable1);
  context.subscriptions.push(myStatusBarItem);
}

export function deactivate() { }
