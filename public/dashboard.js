
 var analytics_data;

 $(document).ready(function(){
    var from_date_input=$('input[name="from_date"]'); //our date input has the name "date"
    var to_date_input=$('input[name="to_date"]'); //our date input has the name "date"

    var container=$('.bootstrap-iso form').length>0 ? $('.bootstrap-iso form').parent() : "body";

    var options={
                format: 'yyyy-mm-dd',
                container: container,
                todayHighlight: true,
                autoclose: true,
    };
    from_date_input.datepicker(options);
    to_date_input.datepicker(options);

    $('#submit').click(function() {
            $('#spinner').show();
    });
    $('#application').on('change', function() {
        $('#spinner').show();
        var treeData = buildTree(analytics_data.data);
        buildRows(analytics_data.countries, treeData);
        $('#spinner').hide();
 	    $('#dashboard').DataTable();
    })

        // process the form
    $('form').submit(function(event) {

        // get the form data
        // there are many ways to get this data using jQuery (you can use the class or id also)
        var formData = {
            'from_date'              : $('input[name=from_date]').val(),
            'to_date'             : $('input[name=to_date]').val()
        };

        event.preventDefault();
        event.returnValue = false;

        if(!isValidDate(formData.from_date)){
            $.alert({
                theme: 'bootstrap', // 'material', 'bootstrap'
                title: 'Query Error',
                content: 'Please input the Begin Date in the correct format YYYY-MM-DD',
                type: 'error'
            });
            $('#spinner').hide();
            return;
        }

        if(!isValidDate(formData.to_date)){
            $.alert({
                theme: 'bootstrap', // 'material', 'bootstrap'
                title: 'Query Error',
                content: 'Please input the End Date in the correct format YYYY-MM-DD',
                type: 'error'

            });
            $('#spinner').hide();
            return;
        }

        if(areDatesValidBetweenThem(formData.from_date,formData.to_date) === false){
              $.alert({
                        theme: 'bootstrap', // 'material', 'bootstrap'
                        title: 'Query Error',
                        content: 'Begin Date must be strictly inferior to End Date!',
                        type: 'error'
              });
              $('#spinner').hide();
              return;
        }

        // process the form
        $.ajax({
            type        : 'POST', // define the type of HTTP verb we want to use (POST for our form)
            url         : 'dashboard', // the url where we want to POST
            contentType : 'application/json',
            data        : JSON.stringify(formData), // our data object
            dataType    : 'json', // what type of data do we expect back from the server
            encode      : true
        })
        .done(function(data) {
                console.log(data);

                //Cache data locally for further filtering
                analytics_data = data;

                var columns = data.countries;
                var apps = data.apps;
                buildAppComboBox(apps);
                var treeData = buildTree(data.data);
                buildRows(columns, treeData);

                $('#spinner').hide();
	            $('#dashboard').DataTable();
          })
         .fail(function(jqXHR, status, err) {
            console.log(status + ":" + err);
            $('#spinner').hide();
            $.alert({
                 theme: 'material',
                 title: 'An error occurred when retrieving analytics data!'
             });
         });
    });

 });

//Build tree from flat data
//group and sum by os, type of transaction , application
function buildTree(data){
                    var app_combobox_value = $('#application').val();
                    var application_filter;
                    if(app_combobox_value != "default"){
                        application_filter = app_combobox_value;
                    }
                    var os_map_aggregates = new Map();
                    for(var line in data)
                    {
                        if(application_filter && application_filter != data[line].application){
                            continue;
                        }
                        var os_row = os_map_aggregates.get(data[line].os);
                        if(!os_row){
                            os_row = {
                                country_aggregates: new Map(),
                                childs: [
                                    {
                                        aggregates: new Map(),
                                        apps: new Map(),
                                        total: 0
                                    },
                                    {
                                        aggregates: new Map(),
                                        apps: new Map(),
                                        total: 0
                                    }
                                ],
                                total: 0
                            };
                        }
                        var country = data[line].country;
                        var country_os_value = os_row.country_aggregates.get(country);
                        if(!country_os_value){
                            country_os_value = 0;
                        }
                        country_os_value += data[line].expenditure + data[line].revenue;

                        os_row.total += data[line].expenditure + data[line].revenue; // cost is always negative here
                        os_row.country_aggregates.set(country, country_os_value);

                        //Expenditure
                        if(data[line].expenditure < 0){
                           var country_expenditure_value = os_row.childs[0].aggregates.get(country);
                           if(!country_expenditure_value){
                                country_expenditure_value = 0;
                           }
                           country_expenditure_value += data[line].expenditure;
                           os_row.childs[0].aggregates.set(country,country_expenditure_value);
                           os_row.childs[0].total += data[line].expenditure;

                           //Apps
                           var app = os_row.childs[0].apps.get(data[line].application);
                           if(!app){
                             app = {
                                aggregates: new Map(),
                                total: 0
                             };
                           }
                           app.aggregates.set(country,data[line].expenditure);
                           app.total += data[line].expenditure;
                           os_row.childs[0].apps.set(data[line].application, app);
                        }

                        //Cost
                        if(data[line].revenue > 0){
                         var country_revenue_value = os_row.childs[1].aggregates.get(country);
                           if(!country_revenue_value){
                                country_revenue_value = 0;
                           }
                           country_revenue_value += data[line].revenue;
                           os_row.childs[1].aggregates.set(country,country_revenue_value);
                           os_row.childs[1].total += data[line].revenue;

                           //Apps
                           var app = os_row.childs[1].apps.get(data[line].application);
                           if(!app){
                             app = {
                                aggregates: new Map(),
                                total: 0
                             };
                           }
                           app.aggregates.set(country, data[line].revenue);
                           app.total += data[line].revenue;
                           os_row.childs[1].apps.set(data[line].application, app);
                        }

                        os_map_aggregates.set(data[line].os, os_row);
                    }
                    return os_map_aggregates;
}

function buildRows(columns, treeData){

        var app_combobox_value = $('#application').val();
        var application_filter;
        if(app_combobox_value != "default"){
            application_filter = app_combobox_value;
        }

        var table = $("<table id='dashboard' style='text-align:left' class='table table-striped table-bordered' width='100%'/>");
        var columnCount = columns.length;
        var row = $(table[0].insertRow(-1));
        var headerCell = $("<th />");
        headerCell.html("");
        row.append(headerCell);
        for (var i = 0; i < columnCount; i++) {
            var headerCell = $("<th />");
            headerCell.html(columns[i]);
            row.append(headerCell);
        }
        var headerTotalCell = $("<th />");
        headerTotalCell.html("Total général");
        row.append(headerTotalCell);

        //Add the data rows.
        for (var key of treeData.keys()) {
            row = $(table[0].insertRow(-1));
            var cell = $("<td style='font-weight:bold;font-size: large;'/>");
            cell.html(key);
            row.append(cell);

            for (var j = 0; j < columnCount; j++) {
                var cell = $("<td style='font-weight:bold;font-size: large;'/>");
                cell.html(roundValue(treeData.get(key).country_aggregates.get(columns[j])));
                row.append(cell);
            }

            var totalCell = $("<td style='font-weight:bold;font-size: large;'/>");
            totalCell.html(roundValue(treeData.get(key).total));
            row.append(totalCell);

            //Append sub aggregates expenditure
            var expenditure_row = $(table[0].insertRow(-1));
            var expenditure_cell = $("<td style='font-weight:bold'/>");
            expenditure_cell.html("<div style='margin-left: 1em'>Expenditure</div>");
            expenditure_row.append(expenditure_cell);

            for (var j = 0; j < columnCount; j++) {
                var cell = $("<td style='font-weight:bold'/>");
                cell.html(roundValue(treeData.get(key).childs[0].aggregates.get(columns[j])));
                expenditure_row.append(cell);
            }

            var totalCellExpenditure = $("<td style='font-weight:bold'/>");
            totalCellExpenditure.html(roundValue(treeData.get(key).childs[0].total));
            expenditure_row.append(totalCellExpenditure);

            //Append apps
            for(var app_key of treeData.get(key).childs[0].apps.keys()){
                  if(!application_filter || application_filter === app_key){
                     app_row = $(table[0].insertRow(-1));
                     var cell = $("<td style='font-style:italic'/>");
                     cell.html("<div style='margin-left: 2em'>"+app_key+"</div>");
                     app_row.append(cell);

                     for (var j = 0; j < columnCount; j++) {
                         var cell = $("<td />");
                         cell.html(roundValue(treeData.get(key).childs[0].apps.get(app_key).aggregates.get(columns[j])));
                         app_row.append(cell);
                     }

                     var totalCell = $("<td />");
                     totalCell.html(roundValue(treeData.get(key).childs[0].apps.get(app_key).total));
                     app_row.append(totalCell);
                  }
            }


            //Append sub aggregates revenue
            var revenue_row = $(table[0].insertRow(-1));
            var revenue_cell = $("<td style='font-weight:bold'/>");
            revenue_cell.html("<div style='margin-left: 1em'>Revenue</div>");
            revenue_row.append(revenue_cell);

            for (var j = 0; j < columnCount; j++) {
                var cell = $("<td style='font-weight:bold'/>");
                cell.html(roundValue(treeData.get(key).childs[1].aggregates.get(columns[j])));
                revenue_row.append(cell);
            }

            var totalCellRevenue = $("<td style='font-weight:bold'/>");
            totalCellRevenue.html(roundValue(treeData.get(key).childs[1].total));
            revenue_row.append(totalCellRevenue);

            //Append apps
            for(var app_key of treeData.get(key).childs[1].apps.keys()){
               if(!application_filter || application_filter === app_key){
                  app_row = $(table[0].insertRow(-1));
                  var cell = $("<td style='font-style:italic'/>");
                  cell.html("<div style='margin-left: 2em'>"+app_key+"</div>");
                  app_row.append(cell);

                  for (var j = 0; j < columnCount; j++) {
                      var cell = $("<td />");
                      cell.html(roundValue(treeData.get(key).childs[1].apps.get(app_key).aggregates.get(columns[j])));
                      app_row.append(cell);
                  }

                  var totalCell = $("<td />");
                  totalCell.html(roundValue(treeData.get(key).childs[1].apps.get(app_key).total));
                  app_row.append(totalCell);
               }
            }
        }

        var footer = table[0].createTFoot();
        var rowFooter = footer.insertRow(-1);
        var footerTotalCell = rowFooter.insertCell(0);
        footerTotalCell.innerHTML = "<div style='font-size:large;font-weight:bold'>Total</div>";
        for (var i = 0; i < columnCount; i++) {
             var footerTotalCell = rowFooter.insertCell(i + 1);
             var total = 0;
             for (var key of treeData.keys()) {
               total += treeData.get(key).country_aggregates.get(columns[i]);
             }
             footerTotalCell.innerHTML = "<div style='font-size:large;font-weight:bold'>" + roundValue(total)+ "</div>";
        }
        var footerTotalCell = rowFooter.insertCell(columnCount + 1);
        var totalGlobal = 0;
        for (var key of treeData.keys()) {
            totalGlobal += treeData.get(key).total;
        }
        footerTotalCell.innerHTML = "<div style='font-size:large;font-weight:bold;'>" + roundValue(totalGlobal) +"</div>";

        var dvTable = $("#dvdashboard");
        dvTable.html("");
        dvTable.append(table);

}

function roundValue(val){
    return Math.round(val * 100) / 100;
}

// Validates that the input string is a valid date formatted as "mm/dd/yyyy"
function isValidDate(dateString)
{
    // First check for the pattern
    if(!/^\d{4}\-\d{1,2}\-\d{1,2}$/.test(dateString))
        return false;

    // Parse the date parts to integers
    var parts = dateString.split("-");
    var day = parseInt(parts[2], 10);
    var month = parseInt(parts[1], 10);
    var year = parseInt(parts[0], 10);

    // Check the ranges of month and year
    if(year < 1000 || year > 3000 || month == 0 || month > 12)
        return false;

    var monthLength = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

    // Adjust for leap years
    if(year % 400 == 0 || (year % 100 != 0 && year % 4 == 0))
        monthLength[1] = 29;

    // Check the range of the day
    return day > 0 && day <= monthLength[month - 1];
}

function areDatesValidBetweenThem(from, to){
    var date_from = new Date(from);
    var date_to = new Date(to);
    var result = date_to > date_from;
    return result;
}

function buildAppComboBox(apps){
    $('#application').empty();
    $('#application').append($('<option>', {
            value: "default",
            text : "Choose an application"
        }));

    $.each(apps, function (i, item) {
        $('#application').append($('<option>', {
            value: item,
            text : item
        }));
    });
}
