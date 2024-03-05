/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/https', 'N/log', 'N/query', 'N/error'], function(record, https, log, query, error) {
    
    function afterSubmit(context) {
        if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
            var salesOrder = context.newRecord;
            
            var latitude = salesOrder.getValue({
                fieldId: 'custbody_shiplatitude'
            });

            if (latitude) {
                log.debug('PROCESSED', 'ALREADY PROCESSED');
                return;
            }

            //Retrieve the address data using the SuiteQL query
            var address = addressQuery(salesOrder.id);

            if (!address) {
                log.error('ADDRESS_NOT_FOUND', 'No address found for the sales order ID: ' + salesOrder.id);
                return;
            }

            // Send address to Geocod.io
            var geocodioResponse = sendToGeocodio(address);

            if (!geocodioResponse) {
                log.error('GEOCODIO_ERROR', 'Failed to fetch response from Geocod.io API');
                return;
            }

            // Parse response to extract latitude and longitude
            var location = parseGeocodioResponse(geocodioResponse);

            if (!location) {
                log.error('GEOCODIO_RESPONSE_ERROR', 'Error parsing Geocodio response');
                return;
            }

            // Print latitude and longitude
            log.debug('Latitude:', location.latitude);
            log.debug('Longitude:', location.longitude);

            try {
                // Update sales order record with latitude and longitude
                record.submitFields({
                    type: salesOrder.type,
                    id: salesOrder.id,
                    values: {
                        custbody_shiplatitude: location.latitude,
                        custbody_shiplongitude: location.longitude
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            } catch (e) {
                log.error('RECORD_UPDATE_ERROR', 'Error updating sales order record: ' + e.message);
            }
        }
    }
    
    function sendToGeocodio(address) {
        var geocodioEndpoint = 'https://api.geocod.io/v1.7/geocode';
        var apiKey = 'API-KEY'; // Replace with your actual API key
        var responseformat = 'simple';
        var limit = 1;
        var url = geocodioEndpoint + '?api_key=' + apiKey + '&q=' + encodeURIComponent(address) + '&limit=' + limit + '&format=' + responseformat;
        log.debug('URL:', url);

        try {
            var response = https.get({
                url: url
            });
            log.debug('Response:', response);
            return response.body;
        } catch (e) {
            log.error('HTTPS_REQUEST_ERROR', 'Error occurred during HTTPS request: ' + e.message);
            return null;
        }
    }
    
    function parseGeocodioResponse(responseBody) {
        try {
            // Parse the response body
            var responseObj = JSON.parse(responseBody);
    
            // Check if the response contains latitude and longitude properties
            if (responseObj.lat !== undefined && responseObj.lng !== undefined) {
                // Extract latitude and longitude
                var latitude = responseObj.lat;
                var longitude = responseObj.lng;
    
                // Return an object with latitude and longitude
                return { latitude: latitude, longitude: longitude };
            } else {
                throw new Error("Latitude or longitude data is missing in the response.");
            }
        } catch (error) {
            log.error("PARSE_RESPONSE_ERROR", "Error parsing Geocodio response: " + error.message);
            return null; // Return null or handle the error as needed
        }
    }

    function addressQuery(newRecordId) {
        var sql = 
            "SELECT " +
            "   Transaction.ID, " +
            "   transactionShippingAddress.zip AS shipzip, " +
            "   transactionShippingAddress.addr1 AS shipaddress1, " +
            "   transactionShippingAddress.addr2 AS shipaddress2, " +
            "   transactionShippingAddress.city AS shipcity, " +
            "   Country.name AS shipcountrycode, " +
            "   transactionShippingAddress.state AS shipstate " +
            "FROM " +
            "   Transaction " +
            "JOIN " +
            "   transactionShippingAddress ON Transaction.shippingaddress = transactionShippingAddress.nkey " +
            "JOIN " +
            "   Country ON transactionShippingAddress.country = Country.id " +
            "WHERE " +
            "   Transaction.ID = " + newRecordId +";"
    
        log.debug({
            title: 'SQL Search',
            details: sql
        });
    
        var queryParams = [];

        var rows = query.runSuiteQL({ query: sql, params: queryParams }).asMappedResults();
    

        if (rows.length > 0) {
                var address = rows[0].shipaddress1 + ', ' + rows[0].shipaddress2 + ', ' + rows[0].shipcity + ', ' + rows[0].shipstate + ', ' + rows[0].shipzip + ', ' + rows[0].shipcountrycode;
            return address;
        } else {
            return null; // Return null if no address found for the given record ID
        }
    }
    
    return {
        afterSubmit: afterSubmit
    };
});
