
var app = null;

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    // items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc2/doc/">App SDK 2.0rc2 Docs</a>'},
    launch: function() {

        app = this;
        app.exporter = Ext.create("GridExporter");

        // read the preliminary estimate values so we can map the T-shirt size to a number
        var configs= [
            {   model : "PreliminaryEstimate", 
                fetch : ['Name','ObjectID','Value'], 
                filters : [] 
            }, 
            {   model : "TypeDefinition",
                fetch : true,
                filters : [ { property:"Ordinal", operator:"=", value:1} ]
            }
        ];

        async.map( configs, this.wsapiQuery, function(err,results) {
            // create the custom renderer
            var type = results[1][0].get("TypePath");
            app.renderer = Ext.create("ComponentRenderer", {
                estimatevalues: results[0]
            });
            // have to add the columns after creating the renderer
            app.renderer.setColumns(app.addColumns());

            // create the export button
            app.addExportButton();
            // create the grid
            app.addFeatureGrid(type);
        });
    },

    // used to maintain a unique set of component team names
    componentNames : [],

    // defines the basic set of columns, will be extended for each component team
    addColumns : function() {
         return [
            { text: 'ID',   dataIndex: 'FormattedID', width : 45,sortable:false },
            { text: 'Name', dataIndex: 'Name', width : 200,sortable:false },  
            { text: 'State', dataIndex: 'State', renderer : app.renderer.renderState,sortable:false },  
            { text: 'P. Estimate', dataIndex: 'PreliminaryEstimate', width : 75, renderer : app.renderer.renderPreliminaryEstimate, sortable:false },
            { text: 'Story Count', dataIndex: 'LeafStoryCount', width : 75, sortable:false},
            { text: 'Story Points', dataIndex: 'LeafStoryPlanEstimateTotal', width : 75,sortable:false}
        ];
    },

    // adds an export button
    addExportButton : function () {
        var button = Ext.create('Rally.ui.Button', {
            text: 'Export',
            handler: function() {
                //Ext.Msg.alert('Button', 'You clicked me');
                app.exporter.exportGrid(app.grid);
            }
        });
        this.add(button);
    },

    // generic function to perform a web services query    
    wsapiQuery : function( config , callback ) {
        Ext.create('Rally.data.WsapiDataStore', {
            autoLoad : true,
            limit : "Infinity",
            model : config.model,
            fetch : config.fetch,
            filters : config.filters,
            listeners : {
                scope : this,
                load : function(store, data) {
                    callback(null,data);
                }
            }
        });
    },

    // called when the set of portfolio items has been loaded, for each item it will then read its
    // children and set them in a property called "Requiremnts"
    featuresLoaded : function(items) {
        var features = items.data.items;
        // asynchronous function to read the children collection
        var loadChildren = function(child,callback) {
            child.getCollection("Children").load({
                fetch: true,
                callback : function(records,operation,success) {
                    callback(null,records);
                }
            });
        };

        // call the loadChildren method for each feature, inner function called
        // when all have been read
        async.map( features, loadChildren, function(err,results) {
            _.each(features, function(f,i) {
                var requirements = results[i];
                f.set("Requirements",requirements);
                app.addComponentNames(requirements);
            });
            // reconfigure the grid when done
            app.grid.reconfigure(app.store,app.renderer.getColumns());
        });
    },

    // extract the set of unique project names
    addComponentNames : function(requirements) {

        var projectNames = _.uniq(_.map(requirements,function(r) { return r.get("Project").Name}));
        _.each(projectNames,function(name) {
            if (_.indexOf(app.componentNames,name)==-1) {
                app.componentNames.push(name);
                app.renderer.getColumns().push( Ext.create('Ext.grid.column.Column',{
                    project : name,
                    renderType : "ComponentEstimate",
                    text: name + ' <br>Comp Est', 
                    dataIndex : "Requirements",
                    renderer : app.renderer.renderComponentValuePreliminaryEstimate,
                    cls : 'component-color',
                    width : 75,
                    sortable:false
                }));
                app.renderer.getColumns().push( Ext.create('Ext.grid.column.Column',{
                    project : name,
                    renderType : "ComponentStoryEstimate",
                    text: name + ' <br>Story Est', 
                    dataIndex : "Requirements",
                    renderer : app.renderer.renderComponentValuePointsEstimate,
                    cls : 'component-color',
                    width : 75,
                    sortable:false
                }));

            }
        });
    },

    addFeatureGrid : function(type) {

        app.store = Ext.create('Rally.data.WsapiDataStore', {
            // model : 'PortfolioItem/Initiative',
            model : type,
            listeners : {
                load: app.featuresLoaded
            },
            fetch : true,
            autoLoad : true
        });

        app.grid = Ext.create('Ext.grid.Panel', {
            title: 'Features',
            listeners : {
                afterrender : function() {
                    
                    // app.grid.reconfigure(app.store,app.renderer.getColumns());
                }
            },
            store: app.store,
            columns: app.renderer.getColumns(),
            // height: 600,
            // width: 1200,
        });

        app.add(app.grid);
        // app.store.load();

    },
    
});
