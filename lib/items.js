var itemdb = require('mineflayer').items;

function lookupItemName(name, database) {
    if (database == undefined) {
        database = itemdb;
    }

    function filter_using_comparator(name_parts, comparator) {
        var matches = [];

        // loop over all the items
        for (var item_id in database) {
            var item = database[item_id.toString()]
            var item_display_name = item.display_name;
            if (item_display_name === undefined) {
                continue;
            }
            var existing_name_parts = item_display_name.split(" ");
            var found_all_name_parts = true;
            for (var j = 0; j < name_parts.length; j++) {
                var item_name = name_parts[j];
                var found_name = false;
                for (var k = 0; k < existing_name_parts.length; k++) {
                    var existing_name = existing_name_parts[k];
                    if (comparator(existing_name, item_name)) {
                        found_name = true;
                        break;
                    }
                }
                if (!found_name) {
                    found_all_name_parts = false;
                    break;
                }
            }
            if (found_all_name_parts) {
                matches.push(database[item_id.toString()]);
            }
        }
        return matches;
    }
    function searchForNameParts(name_parts) {
        var comparators = [
            function(s1, s2) { return s1.toLowerCase() == s2.toLowerCase(); },
            function(s1, s2) { return s1.slice(0, s2.length).toLowerCase() == s2.toLowerCase(); },
            function(s1, s2) { return s1.toLowerCase().indexOf(s2.toLowerCase()) != -1; },
        ];
        var results = [];
        for (i = 0; i < comparators.length; i++) {
            temp = filter_using_comparator(name_parts, comparators[i]);
            for (var j = 0; j < temp.length; j++) {
                results.push(temp[j]);
            }
            if (results.length !== 0) {
                return results;
            }
        }
        return results;
    }
    var name_parts = name.split(" ");
    var results = searchForNameParts(name_parts);

    var number_or_words_results = [];

    if (results.length > 1) {
        // try to resolve ambiguity by number of words
        for (i = 0; i < results.length; i++) {
            var result = results[i];
            if (result.display_name.split(" ").length === name_parts.length) {
                number_or_words_results.push(result);
            }
        }
    }

    if (number_or_words_results.length === 1) {
        return number_or_words_results;
    }
    return results;
}

exports.lookupItemName = lookupItemName;