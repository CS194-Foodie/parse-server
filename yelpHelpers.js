var Yelp = require('yelp');
var yelp = new Yelp({
	consumer_key: process.env.YELP_CONSUMER_KEY,
	consumer_secret: process.env.YELP_CONSUMER_SECRET,
	token: process.env.YELP_TOKEN,
	token_secret: process.env.YELP_TOKEN_SECRET
});

// This returns a promise
function testFunc(term) {
	return yelp.search({ term: term, location: "Palo Alto" }).then(function(data) {
		return data;
	});
}

module.exports = testFunc;