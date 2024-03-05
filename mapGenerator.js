/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/log', 'N/query', 'N/ui/serverWidget', 'N/error'], function(log, query, serverWidget, error) {

    function generateSearchResults(context) {
        var searchResults = [];
        try {
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
                    Transaction.tranDate BETWEEN SYSDATE-2 AND SYSDATE
                    AND Transaction.custbody_shiplatitude IS NOT NULL
            `;
    
            var resultSet = query.runSuiteQL({
                query: suiteQLQuery
            });
    
            if (!resultSet || !resultSet.hasOwnProperty('iterator')) {
                throw error.create({
                    name: 'INVALID_RESULT_SET',
                    message: 'The result set returned is invalid or does not support iteration.'
                });
            }
    
            resultSet.iterator().each(function(result) {
                // Extract data from the result and push it into the searchResults array
                // Example:
                searchResults.push({
                    transactionID: result.value.values[0],
                    number: result.value.values[1],
                    shipaddressee: result.value.values[2],
                    shipzip: result.value.values[3],
                    shipaddress1: result.value.values[4],
                    shipaddress2: result.value.values[5],
                    shipcity: result.value.values[6],
                    shipcountrycode: result.value.values[7],
                    shipstate: result.value.values[8],
                    tranDate: result.value.values[9],
                    latitude: result.value.values[10],
                    longitude: result.value.values[11]
                });
                return true; // continue iteration
            });
    
            log.debug({
                title: 'Search Results',
                details: searchResults
            });
    
        } catch (e) {
            log.error({
                title: 'Error generating search results',
                details: e
            });
        }
        return searchResults;
    }
    

    function generateHTMLTable(rows) {
        var tableRows = '';
        // Iterate through the rows and generate table rows
        rows.forEach(function(row) {
            tableRows += `<tr>
                <td>${row.transactionID}</td>
                <td>${row.number}</td>
                <td>${row.tranDate}</td>
                <td>${row.shipaddressee}</td>
                <td>${row.shipzip}</td>
                <td>${row.shipaddress1}</td>
                <td>${row.shipaddress2}</td>
                <td>${row.shipcity}</td>
                <td>${row.shipstate}</td>
                <td>${row.shipcountrycode}</td>
            </tr>`;
        });
        
        // Construct the HTML table
        var htmlTable = `
            <table id="resultsTable" name="resultsTable" class="table table-striped table-bordered" style="margin-top: 18px;">
                <thead>
                    <tr style="background-color: #eee;">
                        <th style="text-align: center;">Transaction ID</th>
                        <th style="text-align: center;">Number</th>
                        <th style="text-align: center;">Date</th>
                        <th style="text-align: center;">Ship Addressee</th>
                        <th style="text-align: center;">Ship Zip</th>
                        <th style="text-align: center;">Shipping Address 1</th>
                        <th style="text-align: center;">Shipping Address 2</th>
                        <th style="text-align: center;">City</th>
                        <th style="text-align: center;">State/Province</th>
                        <th style="text-align: center;">Country</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <script type="text/javascript">
			window.jQuery = window.$ = jQuery;
			$('#resultsTable').DataTable(
				{
					order: [[1, 'asc']],
                    pageLength: 10 // Set the default number of entries per page

				}
			);			
		    </script>
        `;
        
        return htmlTable;
    }
    

    function handleRequest(context) {
        if (context.request.method === 'GET') {
            var form = serverWidget.createForm({
                title: 'Sales Order Map'
            });

            var field = form.addField({
                id: 'custpage_map',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Map'
            });

            var searchResults = generateSearchResults(context);
            var htmlTable = generateHTMLTable(searchResults);

            // Add Bootstrap and DataTables links
            var htmlHeader = `
                <!-- Bootstrap -->
                <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
                <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>

                <!-- DataTables -->
                <link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/1.10.25/css/jquery.dataTables.css">
                <script type="text/javascript" charset="utf8" src="https://cdn.datatables.net/1.10.25/js/jquery.dataTables.js"></script>
            `;

            var htmlContent = htmlHeader + '<p style="margin-top: 36px; font-weight: 600;">' +
                searchResults.length + ' records were found.</p>' + htmlTable;

            field.defaultValue = htmlContent;

            // Add Google Maps script
            var googleMapsScript = `
            <h3>Google Map with Markers</h3>
            <div id="map" style="height: 800px; width: 100%;"></div>
            <script>
                function initMap() {
                    var map = new google.maps.Map(document.getElementById("map"), {
                        zoom: 4,
                        center: { lat: 0, lng: 0 }
                    });

                    var bounds = new google.maps.LatLngBounds();

                    // Add markers for each address with info windows
                    var addresses = ${JSON.stringify(searchResults)};
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

            context.response.writePage(form);
        }
    }

    function onRequest(context) {
        try {
            handleRequest(context);
        } catch (e) {
            log.error({
                title: 'Error',
                details: e
            });
            // Handle error
        }
    }

    return {
        onRequest: onRequest
    };
});
