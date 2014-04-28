
var app = null;

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    componentNames : [],
    // items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc2/doc/">App SDK 2.0rc2 Docs</a>'},
    items: [ 
        {   itemId : "exportContainer",
                layout : "column",
                items : [ 
                    {
                        itemId : "exportButton", margin : 10
                    },
                    {
                        itemId : "exportLink", margin : "12 0 0 10"
                    }
                ]
        },
        {
            itemId : "container", layout : "column"
        }
    ],
    config: {
        defaultSettings: {
            parentId : '',
            showStoryColumns : false
        }
    },

    getSettingsFields: function() {
        return [
            {
                name: 'parentId',
                xtype: 'rallytextfield',
                label : "Parent Portfolio Item ID"
            },
            {
                name: 'showStoryColumns',
                xtype: 'rallycheckboxfield',
                label: 'Show Story Columns'
            }
        ];
    },

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
            },
            {   model : "TypeDefinition",
                fetch : true,
                filters : [ { property:"Ordinal", operator:"=", value:0} ]
            }

        ];

        async.map( configs, this.wsapiQuery, function(err,results) {
            // create the custom renderer
            // var type = results[1][0].get("TypePath");  // PortfolioItem/Initiative
            app.featureType = results[1][0].get("TypePath"); // lowest level item
            app.releaseType = results[2][0].get("TypePath"); // lowest level item
            app.renderer = Ext.create("ComponentRenderer", {
                estimatevalues: results[0]
            });
            // have to add the columns after creating the renderer
            app.renderer.setColumns(app.addColumns());

            // create the export button
            app.exportButton = app.addExportButton();
            // app.down("#container").add(app.tagpicker);
            app.down("#exportButton").add(app.exportButton);
            app.createGrid();
        });
    },

    onTimeboxScopeChange: function(newTimeboxScope) {
        this.callParent(arguments);
        console.log("release selected");
        var timeboxScope = app.getContext().getTimeboxScope();
        console.log("timeboxscope",timeboxScope);
        if(timeboxScope!=null) {
            var record = timeboxScope.getRecord();
            var name = record.get('Name');
            app.releaseName = name;
            console.log("name",name);
        }
    },

    // defines the basic set of columns, will be extended for each component team
    addColumns : function() {
         return [
            { locked : true, text: 'ID',   dataIndex: 'FormattedID', width : 45,sortable:false },
            { locked : true, text: 'Name', dataIndex: 'Name', width : 200,sortable:false },  
            { locked : true, text: 'State', dataIndex: 'State', renderer : app.renderer.renderState,sortable:false },  
            { locked : true, text: 'Feature PEst', dataIndex: 'PreliminaryEstimate', width : 85, renderer : app.renderer.renderPreliminaryEstimate, sortable:false },
            { locked : true, text: 'S Team<br/>Story Pts', dataIndex: 'LeafStoryPlanEstimateTotal', width : 85,sortable:false},
            { locked : true, text: 'S Team<br/>Story Cnt', dataIndex: 'LeafStoryCount', width : 85, sortable:false}
        ];
    },

    // adds an export button
    addExportButton : function () {
        var button = Ext.create('Rally.ui.Button', {
            text: 'Export',
            handler: function() {
                //Ext.Msg.alert('Button', 'You clicked me');
                var link = app.down("#exportLink");
                console.log("link",link);
                link.update(app.exporter.exportGrid(app.grid));
                //app.exporter.exportGrid(app.grid);
            }
        });
        //this.add(button);
        return button;
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
        console.log("items",items.data.items.length);
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

            app.addComponentTotalColumn();
            _.each(features, function(f,i) {
                var requirements = results[i];
                f.set("Requirements",requirements);
                app.addComponentNames(requirements);
            });
            // reconfigure the grid when done
            app.grid.reconfigure(app.store,app.renderer.getColumns());
        });
    },

    addComponentTotalColumn : function() {
        if (app.componentNames.length===0) {

            app.renderer.getColumns().push( Ext.create('Ext.grid.column.Column',{
                renderType : "renderTotalComponentValuePreliminaryEstimate",
                text: name + 'S Team PEst', 
                dataIndex : "Requirements",
                renderer : app.renderer.renderTotalComponentValuePreliminaryEstimate,
                cls : 'component-color',
                width : 85,
                sortable:false,
                locked : true,
                align : 'right'
            }));
        }

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
                    text: name + ' <br>Team PEst', 
                    dataIndex : "Requirements",
                    renderer : app.renderer.renderComponentValuePreliminaryEstimate,
                    cls : 'component-color',
                    width : 85,
                    sortable:false,
                    align : 'right'
                }));

                // only show these two columns if configured.
                if (app.showStoryColumns===true) {
                    app.renderer.getColumns().push( Ext.create('Ext.grid.column.Column',{
                        project : name,
                        renderType : "ComponentStoryEstimate",
                        text: name + ' <br>Team StPts', 
                        dataIndex : "Requirements",
                        renderer : app.renderer.renderComponentValuePointsEstimate,
                        cls : 'component-color',
                        width : 85,
                        sortable:false,
                        align : 'right'
                    }));
                    app.renderer.getColumns().push( Ext.create('Ext.grid.column.Column',{
                        project : name,
                        renderType : "WorkRemaining",
                        text: name + ' <br>Work Remaining', 
                        dataIndex : "Requirements",
                        renderer : app.renderer.renderWorkRemaining,
                        cls : 'component-color',
                        width : 85,
                        sortable:false,
                        align : 'right'
                    }));
                }
            }
        });
    },

    createGrid : function() {

        // check for configured parent id
        var parentIds = app.getSetting('parentId');
        app.showStoryColumns = app.getSetting('showStoryColumns');
        var filter = [];

        // support filtering the features by a comma listed set of possible 
        // parent portfolio items.
        _.each(parentIds.split(","), function(parentId,i) {
            if (parentId!=="") {
                var f = Ext.create('Rally.data.wsapi.Filter', {
                    property: 'Parent.FormattedID', operator: '=', value: parentId.replace(/^\s+|\s+$/g,'') } 
                );
                filter = (i==0) ? f : filter.or(f);
            }
        });

        console.log("filter:",filter.toString());
        if (_.isNull(app.store)||_.isUndefined(app.store)) {

            app.store = Ext.create('Rally.data.WsapiDataStore', {
                // model : 'PortfolioItem/Initiative',
                model : app.featureType,
                listeners : {
                    load: app.featuresLoaded
                },
                sorters: [
                    {
                        property: 'Rank',
                        direction: 'DSC'
                    }
                ],
                fetch : true,
                autoLoad : true,
                filters : filter
            });
        }

        app.grid = Ext.create('Ext.grid.Panel', {
            title: 'Features',
            listeners : {
                afterrender : function() {
                    console.log("grid rendered");
                }
            },
            store: app.store,
            columns: app.renderer.getColumns(),
        });

        app.add(app.grid);

    }
});
