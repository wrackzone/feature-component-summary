
var app = null;

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    // items:{ html:'<a href="https://help.rallydev.com/apps/2.0rc2/doc/">App SDK 2.0rc2 Docs</a>'},
    launch: function() {

        app = this;
        this.addFeatureGrid();
    },

    componentNames : [],
    columnCfgs : [
                     'FormattedID',
                     'Name',
                     'Owner'
                 ],

    defectColumn : {  
        text: "Defects", width:100, 
        renderer : function(value, metaData, record, rowIdx, colIdx, store, view) {
            var defects = record.get("Defects");
            if (defects && defects.length > 0) {
                var states = _.countBy(defects, function(d) { 
                    return d.get("State")!= "Closed" ? "Open" : "Closed";
                });
                states.Open = states.Open !== undefined ? states.Open : 0;
                    states.Open = 0 
                states.length = defects.length;
                var tpl = Ext.create('Ext.Template', "{Open}/{length}", { compiled : true } );
                return tpl.apply(states);
            } else
                return "";
        }
    },

    columnRenderer : function(value, metaData, record, rowIdx, colIdx, store, view) {
        // renders a component teams column
        console.log("columnRenderer");
        console.log("v",value);
        console.log("m",metaData);
        console.log("colIdx",colIdx);
        return "";

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
            console.log("configs",app.grid.getColumnCfgs());
            //file:///Users/bmullan/Documents/Apps/feature-component-summary/App-debug.html
            app.grid.reconfigure(app.grid.getStore(),app.columnCfgs);
            //app.grid.getStore().load();
        });
    },

    // extract the set of unique project names
    addComponentNames : function(requirements) {

        var projectNames = _.uniq(_.map(requirements,function(r) { return r.get("Project").Name}));
        _.each(projectNames,function(name) {
            if (_.indexOf(app.componentNames,name)==-1) {
                app.componentNames.push(name);
                app.columnCfgs.push( Ext.create('Ext.grid.column.Column',{
                    text: name, 
                    header : name,
                    dataIndex : name,
                    defaultWidth : 100,
                    renderer : app.columnRenderer
                }));
            }
        });
        console.log("projectNames",app.componentNames);
    },

    addFeatureGrid : function() {
        var viewport = Ext.create('Ext.Viewport');
        Rally.data.ModelFactory.getModel({
         type: 'PortfolioItem/Initiative',
         success: function(featureModel) {
            app.grid = Ext.create('Rally.ui.grid.Grid',{
                 xtype: 'rallygrid',
                 model: featureModel,
                 listeners : {
                    load : app.featuresLoaded
                 },
                 columnCfgs : app.columnCfgs
             });
            console.log("store",app.grid.getStore());
             viewport.add(app.grid);
         }
        });
    },
    
    getSnapshots : function(record, callback) {

        var that = this;
        var fetch = ['ObjectID','_UnformattedID','State','Priority','Severity','_ItemHierarchy','_TypeHierarchy'];
        var hydrate = ['_TypeHierarchy','State','Priority','Severity'];
        
        var find = {
                '_TypeHierarchy' : { "$in" : ["Defect"]} ,
                '_ProjectHierarchy' : { "$in": app.getContext().getProject().ObjectID },
                '__At' : 'current',
                "_ItemHierarchy" : { "$in" : record.get("ObjectID")  }
        };

        var storeConfig = {
            find : find,
            autoLoad : true,
            pageSize:1000,
            limit: 'Infinity',
            fetch: fetch,
            hydrate: hydrate,
            listeners : {
                scope : this,
                load: function(store, snapshots, success) {
                    // console.log("success",success);
                    // console.log("completed snapshots:", snapshots.length);
                    callback(null,snapshots);
                }
            }
        };

        var snapshotStore = Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);

    }
    
});
