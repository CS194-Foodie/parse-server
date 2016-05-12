
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});


// Send a restaurant name, we will return all matching restaurants
Parse.Cloud.define('eventQuery', function(req, res) {
	var Event = Parse.Object.extend("Event"); // specify name of type you're querying for
	var query = new Parse.Query(Event); // makes a new query over Events
	var restuarantName = req.params.restuarantName;
	query.equalTo("restaurantName", restuarantName);
	query.first().then(function(response) {
		res.success(response);
	}, function(error) {
		res.error(error);
	});
});
