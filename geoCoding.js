/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/https', 'N/log'], function(record, https, log) {
    
    function afterSubmit(context) {
        if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
            var salesOrder = context.newRecord;
            
            // Get the shipping address from the sales order
            var shippingAddress = salesOrder.getValue({
                fieldId: 'shipaddress'
            });

            var latitude = salesOrder.getValue({
                fieldId: 'custbody_shiplatitude'
            });

            if (latitude){
                log.debug('PROCESSED', 'ALREADY PROCESSED');
                return;
            }

            var twoLinesString = extractShippingRegion(shippingAddress);
            
            // Make sure shipping address is not empty
            if (shippingAddress) {
                // Send address to Geocod.io
                var geocodioResponse = sendToGeocodio(twoLinesString);
                
                // Parse response to extract latitude and longitude
                var location = parseGeocodioResponse(geocodioResponse);
                
                // Print latitude and longitude
                log.debug('Latitude:', location.latitude);
                log.debug('Longitude:', location.longitude);

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
            }
        }
    }
    
    function sendToGeocodio(address) {
        var geocodioEndpoint = 'https://api.geocod.io/v1.7/geocode';
        var apiKey = 'API_KEY'; // Replace with your actual API key
        var responseformat = 'simple';
        var limit = 1;
        var url = geocodioEndpoint + '?api_key=' + apiKey + '&q=' + encodeURIComponent(address) + '&limit=' + limit + '&format=' + responseformat;
        log.debug('URL:', url)


        var response = https.get({
            url: url
        });
        log.debug('Response:', response);
        return response.body;
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
            log.debug("Error parsing Geocodio response:", error.message);
            return null; // Return null or handle the error as needed
        }
    }
    

    function extractShippingRegion(shippingAddress) {
        // Split the shipping address into lines
        var addressLines = shippingAddress.split('\n');
        
        // Loop through each line of the address
        for (var i = 1; i < addressLines.length; i++) {
            // Check if the current line contains "United States" or "Canada"
            if (addressLines[i].indexOf('United States') !== -1 || addressLines[i].indexOf('Canada') !== -1) {
                // Return the current line and the line above it
                return addressLines[i - 1] + '\n' + addressLines[i];
            }
        }
        
        // Return null if no matching line is found
        return null;
    }
    
    return {
        afterSubmit: afterSubmit
    };
});