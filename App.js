
var app = null;

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    // items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc2/doc/">App SDK 2.0rc2 Docs</a>'},
    launch: function() {

        app = this;
        app.exporter = Ext.create("GridExporter");
        app.renderer = Ext.create("ComponentRenderer");

        app.columns = [
            { text: 'ID',   dataIndex: 'FormattedID', width : 45 },
            { text: 'Name', dataIndex: 'Name', width : 200 },  
            { text: 'State', dataIndex: 'State', renderer : app.renderer.renderState },  
            { text: 'P. Estimate', dataIndex: 'PreliminaryEstimate', width : 75, renderer : app.renderer.renderPreliminaryEstimate },
            { text: 'Story Count', dataIndex: 'LeafStoryCount', width : 75},
            { text: 'Story Points', dataIndex: 'LeafStoryPlanEstimateTotal', width : 75}
        ];

        var configs= [{ model : "PreliminaryEstimate", 
                       fetch : ['Name','ObjectID','Value'], 
                       filters : [] 
        }];

        async.map( configs, this.wsapiQuery, function(err,results) {
            app.estimateValues = results[0];
            app.addExportButton();
            app.addFeatureGrid();
        });
    },

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

    componentNames : [],

    featuresLoaded : function(items) {
        var features = items.data.items;
        console.log("features",features);

        var loadChildren = function(child,callback) {
            child.getCollection("Children").load({
                fetch: true,
                callback : function(records,operation,success) {
                    callback(null,records);
                }
            });
        };

        async.map( features, loadChildren, function(err,results) {
            _.each(features, function(f,i) {
                var requirements = results[i];
                console.log(f.get("Name"), requirements.length,requirements);
                f.set("Requirements",requirements);
                app.addComponentNames(requirements);
            });
            app.grid.reconfigure(app.store,app.columns);
        });
    },

    // extract the set of unique project names
    addComponentNames : function(requirements) {

        var projectNames = _.uniq(_.map(requirements,function(r) { return r.get("Project").Name}));
        _.each(projectNames,function(name) {
            if (_.indexOf(app.componentNames,name)==-1) {
                app.componentNames.push(name);
                app.columns.push( Ext.create('Ext.grid.column.Column',{
                    text: name, 
                    dataIndex : "Requirements",
                    renderer : app.renderer.renderComponentValue,
                    cls : 'component-color',
                    width : 75
                }));
            }
        });
        console.log("projectNames",app.componentNames);
    },

    addFeatureGrid : function() {

        app.store = Ext.create('Rally.data.WsapiDataStore', {
            model : 'PortfolioItem/Initiative',
            listeners : {
                load: app.featuresLoaded
            },
            fetch : true,
            // autoLoad : true
        });

        app.grid = Ext.create('Ext.grid.Panel', {
            title: 'Features',
            listeners : {
                afterrender : function() {
                    app.grid.reconfigure(app.store,app.columns);
                }
            },
            store: app.store,
            columns: [ app.columns
            ],
            height: 600,
            width: 1200,
        });

        app.add(app.grid);
        app.store.load();

    },
    
});
