# newsheadlines
It shows news headlines on the status bar.
![example](example.gif)
## Customization

Some cutomizations are available in Settings.
### newsSource
It only can accept RSS2.0.
```json
"newsheadlines.newsSource": [
    "https://news.google.com/rss/search?q=inurl:www.reuters.com&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=inurl:www.cnn.com&hl=en-US&gl=US&ceid=US:en",
]
```
### length
The length of the headline's character on the status bar
```json
"newsheadlines.length": 40
```
### showIntervalSeconds
Interval seconds to show a next news
```json
"newsheadlines.showIntervalSeconds": 30
```