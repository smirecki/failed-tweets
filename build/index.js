'use strict';

// Load .env files from root based on the NODE_ENV value
require('dotenv').load();

var Twitter = require('twitter');

var client = new Twitter({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.ACCESS_TOKEN_KEY,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

var USERPATH = '/statuses/user_timeline',
    MENTIONSPATH = '/statuses/mentions_timeline';

// Check our rate limit requests remaining first
client.get('application/rate_limit_status', { resources: 'statuses' }, function (err, data) {

    if (!err) {
        var stats = data.resources.statuses,
            userLeft = stats[USERPATH].remaining,
            mentionsLeft = stats[MENTIONSPATH].remaining;

        if (userLeft === 0 || mentionsLeft === 0) {
            console.log('Rate limit exceeded. Try again in 15 minutes.');
            process.exit(0);
        }
    }
});

function getMentions() {
    return new Promise(function (resolve, reject) {
        var params = {
            count: 100
        };

        client.get(MENTIONSPATH, params, function (err, mentions) {
            if (!err) {
                resolve(mentions);
            }
        });
    });
}

function getTweets(mentions) {
    return new Promise(function (resolve, reject) {
        var params = {
            screen_name: process.env.USER_NAME,
            count: 100
        };

        client.get(USERPATH, params, function (err, tweets) {
            if (!err) {
                resolve([tweets, mentions]);
            }
        });
    });
}

function isFailedTweet(tweet, mentions) {
    // A flag for if every test for failure happens
    var failed = false;

    // Check if tweet wasn't favorited or retweeted
    // and wasn't just a reply to someone
    if (tweet.favorite_count === 0 && tweet.retweet_count === 0 && tweet.in_reply_to_status_id_str === null) {
        failed = true;

        // Loop through the mentions
        for (var i2 = 0, n2 = mentions.length; i2 < n2; i2++) {

            // Check if the tweet was in any mentions
            if (tweet.id_str === mentions[i2].in_reply_to_status_id_str) {

                // Don't count being the only reply to yourself
                if (mentions[i2].in_reply_to_user_id_str === mentions[i2].user.id_str) {

                    failed = true;
                } else {
                    failed = false;
                }
                break;
            }
        }
    }
    return failed;
}

getMentions().then(function (mentions) {
    return getTweets(mentions);
}).then(function (promiseValues) {
    var tweets = promiseValues[0],
        mentions = promiseValues[1],
        tweet = null;

    console.log("Nobody favorited/retweeted/replied to these tweets:\n");

    // Loop through the tweets
    for (var i = 0, n = tweets.length; i < n; i++) {
        tweet = tweets[i];

        if (isFailedTweet(tweet, mentions)) {
            console.log('https://twitter.com/' + process.env.USER_NAME + '/status/' + tweet.id_str);

            console.log(tweet.text);
            console.log();
        }
    }
})['catch'](function (reason) {
    console.log('Caught Error:', reason);
});
