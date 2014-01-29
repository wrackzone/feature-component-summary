
var app = null;

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    // items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc2/doc/">App SDK 2.0rc2 Docs</a>'},
    launch: function() {

        app = this;

        var configs= [{ model : "PreliminaryEstimate", 
                       fetch : ['Name','ObjectID','Value'], 
                       filters : [] 
        }];

        async.map( configs, this.wsapiQuery, function(err,results) {
            app.estimateValues = results[0];
            app.addFeatureGrid();
        });
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
    columns : [
        { text: 'ID',   dataIndex: 'FormattedID', width : 45 },
        { text: 'Name', dataIndex: 'Name', width : 200 },  
        { text: 'State', dataIndex: 'State', renderer : function(value) { return value ? value._refObjectName : ""; } },  
        { text: 'P. Estimate', dataIndex: 'PreliminaryEstimate', width : 75, renderer : function(value) { 
            console.log(value);
            return value ? value._refObjectName + " (" + app.pointValue(value)+")" : ""; 
            } 
        },  
        { text: 'Story Count', dataIndex: 'LeafStoryCount', width : 75},
        { text: 'Story Points', dataIndex: 'LeafStoryPlanEstimateTotal', width : 75}
    ],

    pointValue : function(est) {
        var p = _.find(app.estimateValues,function(ev) {
            return ev.get("Name") === est._refObjectName;
        });
        return p ? p.get("Value") : 0;
    },

    pointValueForEstimate : function(pi) {

        if (pi.get("PreliminaryEstimate")!== null) {
            return app.pointValue(pi.get("PreliminaryEstimate"));
        } else {
            return 0;
        }
    },

    sumRequirementEstimates : function(reqs) {

        return _.reduce( reqs, function(memo,r) { 
            return memo + app.pointValueForEstimate(r);
        }, 0 );

    },

    columnRenderer : function(value, metaData, record, rowIdx, colIdx, store, view) {
        // renders a component teams column
        console.log("v",value,"colIdx",colIdx,"name",app.columns[colIdx].text);
        var name = app.columns[colIdx].text;
        var reqs = _.filter(value,function(r) {
            return r.get("Project").Name === name; 
        })
        // console.log("colIdx",colIdx);
        return reqs ? app.sumRequirementEstimates(reqs) : 0;

    },

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
                    renderer : app.columnRenderer,
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
