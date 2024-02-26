/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/query', 'N/error', 'N/log'],
    function (serverWidget, query, error, log) {

        function onRequest(context) {
            if (context.request.method === 'GET') {
                var form = serverWidget.createForm({
                    title: 'Sales Order Map'
                });

                var field = form.addField({
                    id: 'custpage_map',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Map'
                });

                var suiteQLQuery = `
                    SELECT
                        Transaction.ID AS transactionID,
                        Transaction.number,
                        transactionShippingAddress.addressee AS shipaddressee,
                        transactionShippingAddress.zip AS shipzip,
                        transactionShippingAddress.addr1 AS shipaddress1,
                        transactionShippingAddress.addr2 AS shipaddress2,
                        transactionShippingAddress.city AS shipcity,
                        transactionShippingAddress.country AS shipcountrycode,
                        transactionShippingAddress.state AS shipstate,
                        Transaction.tranDate,
                        Transaction.custbody_shiplatitude as latitude,
                        Transaction.custbody_shiplongitude as longitude
                    FROM
                        Transaction
                    JOIN
                        transactionShippingAddress ON Transaction.shippingaddress = transactionShippingAddress.nkey
                    WHERE
                        Transaction.tranDate BETWEEN SYSDATE-30 AND SYSDATE
                        AND Transaction.custbody_shiplatitude IS NOT NULL
                `;

                try {
                    var resultSet = query.runSuiteQL({
                        query: suiteQLQuery
                    });

                    if (!resultSet || !resultSet.hasOwnProperty('iterator')) {
                        throw error.create({
                            name: 'INVALID_RESULT_SET',
                            message: 'The result set returned is invalid or does not support iteration.'
                        });
                    }

                    var queryResults = [];

                    resultSet.iterator().each(function(result) {
                        log.debug({
                            title: 'SuiteQL Result',
                            details: result
                        });

                        var transactionID = result.value.values[0];
                        var transactionNumber = result.value.values[1];
                        var shipAddressee = result.value.values[2];
                        var shipZip = result.value.values[3];
                        var shipAddr1 = result.value.values[4];
                        var shipAddr2 = result.value.values[5];
                        var shipCity = result.value.values[6];
                        var shipCountry = result.value.values[7];
                        var shipState = result.value.values[8];
                        var transactionDate = result.value.values[9];
                        var latitude = result.value.values[10];
                        var longitude = result.value.values[11];

                        queryResults.push({
                            transactionID: transactionID,
                            number: transactionNumber,
                            tranDate: transactionDate,
                            latitude: latitude,
                            longitude: longitude,
                            shipaddressee: shipAddressee,
                            shipzip: shipZip,
                            shipaddress1: shipAddr1,
                            shipaddress2: shipAddr2,
                            shipcity: shipCity,
                            shipcountrycode: shipCountry,
                            shipstate: shipState
                        });

                        return true; // continue iteration
                    });

                    // Log number of results
                    log.debug({
                        title: 'Query Results',
                        details: 'Number of results: ' + queryResults.length
                    });

                    // Build HTML table
                    var tableHTML = '<table border="1"><tr><th>Transaction ID</th><th>Number</th><th>Transaction Date</th><th>Shipping Address</th></tr>';
                    queryResults.forEach(function(result) {
                        var address = result.shipaddressee + ', ' + result.shipaddress1 + ', ' + result.shipaddress2 + ', ' + result.shipcity + ', ' + result.shipstate + ' ' + result.shipzip + ', ' + result.shipcountrycode;
                        tableHTML += '<tr><td>' + result.transactionID + '</td><td>' + result.number + '</td><td>' + result.tranDate + '</td><td>' + address + '</td></tr>';
                    });
                    tableHTML += '</table>';

                    // Set HTML content for the map field
                    field.defaultValue = tableHTML;

                    // Append Google Maps script with markers and info windows to the field
                    var googleMapsScript = `
                        <h3>Google Map with Markers</h3>
                        <div id="map" style="height: 400px; width: 100%;"></div>
                        <script>
                            function initMap() {
                                var map = new google.maps.Map(document.getElementById("map"), {
                                    zoom: 4,
                                    center: { lat: 0, lng: 0 }
                                });

                                var bounds = new google.maps.LatLngBounds();

                                // Add markers for each address with info windows
                                var addresses = ${JSON.stringify(queryResults)};
                                addresses.forEach(function(address) {
                                    var latLng = new google.maps.LatLng(address.latitude, address.longitude);
                                    var marker = new google.maps.Marker({
                                        position: latLng,
                                        map: map,
                                        title: address.shipaddressee
                                    });
                                    bounds.extend(latLng);

                                    // Create info window for each marker
                                    var infoWindowContent = '<div><b>' + address.shipaddressee + '</b><br>' +
                                        address.shipaddress1 + '<br>' +
                                        address.shipaddress2 + '<br>' +
                                        address.shipcity + ', ' + address.shipstate + ' ' + address.shipzip + '<br>' +
                                        address.shipcountrycode +
                                        '</div>';

                                    var infoWindow = new google.maps.InfoWindow({
                                        content: infoWindowContent
                                    });

                                    // Open info window when marker is clicked
                                    marker.addListener('click', function() {
                                        infoWindow.open(map, marker);
                                    });
                                });

                                // Fit map to bounds
                                map.fitBounds(bounds);
                            }
                        </script>
                        <script src="https://maps.googleapis.com/maps/api/js?key=API_KEY&callback=initMap" async defer></script>
                    `;

                    field.defaultValue += googleMapsScript;

                } catch (e) {
                    log.error({
                        title: 'Error executing SuiteQL query',
                        details: e
                    });
                }

                context.response.writePage(form);
            }
        }

        return {
            onRequest: onRequest
        };
    });
