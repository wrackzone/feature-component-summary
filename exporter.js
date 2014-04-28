                // Derived and simplified from example on bryntum.com
Ext.define("ComponentRenderer", function() {

    var self;

    return {

        config : {
            estimatevalues : [],
            columns : []
        },

        constructor:function(config) {
            self = this;
            this.initConfig(config);
            return this;
         },

        // have to add the colIdx to the count of locked columns
        offsetColumnIndex : function(col,colIdx) {
            var cols = _.filter(col.getColumns(),function(c) { 
                return c.locked == true;
            });

            return cols.length + colIdx;
        },

        renderPreliminaryEstimate : function(value) { 
            return value ? value._refObjectName + " (" + self.pointValue(value)+")" : ""; 
        },

        renderState : function(value) { 
            return value ? value._refObjectName : ""; 
        },



        renderComponentValuePointsEstimate : function(value, metaData, record, rowIdx, colIdx, store, view) {
            var idx = self.offsetColumnIndex(self,colIdx);
            var name = self.getColumns()[idx].project;
            var reqs = _.filter(value,function(r) {
                return r.get("Project").Name === name; 
            })
            var val = reqs ? 
                _.reduce( reqs, function(memo,r) { 
                    return memo + r.get("LeafStoryPlanEstimateTotal");
                }, 0 ) : 0;
            return val !== 0 ? val : "";
        },

        renderTotalComponentValuePreliminaryEstimate : function(value, metaData, record, rowIdx, colIdx, store, view) {
            var val = value ? self.sumRequirementEstimates(value) : 0;
            return val !== 0 ? val : "";
        },

        renderWorkRemaining : function(value, metaData, record, rowIdx, colIdx, store, view) {
            var idx = self.offsetColumnIndex(self,colIdx);
            var name = self.getColumns()[idx].project;
            var reqs = _.filter(value,function(r) {
                return r.get("Project").Name === name; 
            })
            var val = reqs ? 
                _.reduce( reqs, function(memo,r) { 
                    var accepted = r.get("AcceptedLeafStoryPlanEstimateTotal");
                    accepted = _.isNull(accepted) ? 0 : accepted;
                    return memo + r.get("LeafStoryPlanEstimateTotal") - accepted ;
                }, 0 ) : 0;
            return val !== 0 ? val : "";
        },

        renderTotalPrePCD : function(value, metaData, record, rowIdx, colIdx, store, view) {
            var val = value ? 
                _.reduce( value, function(memo,r) { 
                    var pcd = r.get("c_PrePCDWorkMM");
                    return memo + (pcd ? pcd : 0) ;
                }, 0 ) : 0;
            return val !== 0 ? val : "";

        },

        renderComponentValuePreliminaryEstimate : function(value, metaData, record, rowIdx, colIdx, store, view) {
            var idx = self.offsetColumnIndex(self,colIdx);
            var name = self.getColumns()[idx].project;
            var reqs = _.filter(value,function(r) {
                return r.get("Project").Name === name; 
            })
            var val = reqs ? self.sumRequirementEstimates(reqs) : 0;
            return val !== 0 ? val : "";
        },

        pointValue : function(est) {
            var p = _.find(self.getEstimatevalues(),function(ev) {
                return ev.get("Name") === est._refObjectName;
            });
            return p ? p.get("Value") : 0;
        },

        pointValueForEstimate : function(pi) {

            if (pi.get("PreliminaryEstimate")!== null) {
                return self.pointValue(pi.get("PreliminaryEstimate"));
            } else {
                return 0;
            }
        },

        sumRequirementEstimates : function(reqs) {

            return _.reduce( reqs, function(memo,r) { 
                return memo + self.pointValueForEstimate(r);
            }, 0 );
        }
    }

});


Ext.define("GridExporter", {
    //dateFormat : 'Y-m-d g:i',
    dateFormat : 'Y-m-d',

    exportGrid: function(grid) {
        if (Ext.isIE) {
            this._ieToExcel(grid);

        } else {
            var data = this._getCSV(grid);
            // window.location = 'data:text/csv;charset=utf8,' + encodeURIComponent(data);
            return "<a href='data:text/csv;charset=utf8," + encodeURIComponent(data) + "' download='export.csv'>Click to download file</a>";
        }
    },

    _escapeForCSV: function(string) {
        string = "" + string;
        if (string.match(/,/)) {
            if (!string.match(/"/)) {
                string = '"' + string + '"';
            } else {
                string = string.replace(/,/g, ''); // comma's and quotes-- sorry, just loose the commas
            }
        }
        return string;
    },

    _getFieldText: function(fieldData,record,col,index) {
        var text;

        if (col && col.renderType === "PrePCD") {
            text = app.renderer.renderTotalPrePCD(fieldData,0,record,0,index);
            return text;
        }

        if (col && col.renderType === "WorkRemaining") {
            // text = app.renderer.renderWorkRemaining(fieldData,0,record,0,index-8);
            text = app.renderer.renderWorkRemaining(fieldData,0,record,0,index - this.fixedCols);
            return text;
        }

        if (col && col.renderType === "ComponentEstimate") {
            text = app.renderer.renderComponentValuePreliminaryEstimate(fieldData,0,record,0,index- this.fixedCols);
            return text;
        }

        if (col && col.renderType === "ComponentStoryEstimate") {
            
            // text = app.renderer.renderComponentValuePointsEstimate (fieldData,0,record,0,index-8);
            text = app.renderer.renderComponentValuePointsEstimate (fieldData,0,record,0,index-this.fixedCols);
            return text;
        }

        if (col && col.renderType === "renderTotalComponentValuePreliminaryEstimate") {
            text = app.renderer.renderTotalComponentValuePreliminaryEstimate (fieldData,0,record,0,index);
            return text;
        }
        

        if (fieldData == null || fieldData == undefined) {
            text = '';

        } else if (fieldData._refObjectName && !fieldData.getMonth) {
            text = fieldData._refObjectName;

        } else if (fieldData instanceof Date) {
            text = Ext.Date.format(fieldData, this.dateFormat);

        } /*else if (!fieldData.match) { // not a string or object we recognize...bank it out
            text = '';

        } */ else {
            text = fieldData;
        }

        return text;
    },

    _getFieldTextAndEscape: function(fieldData,record,col,index) {
        var string  = this._getFieldText(fieldData,record,col,index);

        return this._escapeForCSV(string);
    },

    // have to add the colIdx to the count of locked columns
    fixedColumnCount : function(columns) {
        var cols = _.filter(columns,function(c) { 
            return c!==undefined && c!==null && c.locked == true;
        });
        return cols.length;
    },

    _getCSV: function (grid) {
        var cols    = grid.columns;
        var store   = grid.store;
        var data    = '';
        this.fixedCols = this.fixedColumnCount(cols);

        // creates a sorted index for the header fields, complicated because 
        // we dont want to sort the fixed columns.
        var createHeaderIndex = function( cols, fixedColsCount ) {
            console.log("fixedColsCount",fixedColsCount);

            var headerIndex = _.object( _.pluck(cols,"text"), _.range(cols.length));
            console.log("headerIndex",headerIndex);

            var keys = _.keys(headerIndex);
            console.log("keys",keys);

            var fixed = keys.slice(0,fixedColsCount);
            console.log("fixed",fixed);

            var variable = keys.slice(fixedColsCount).sort();
            console.log("variable",variable);

            var sortedKeys = _.union(fixed,variable);

            console.log("sortedKeys",sortedKeys);

            var values = _.map( sortedKeys, function (key) {
                return headerIndex[key];
            });

            console.log("values",values);

            var index = _.object( sortedKeys, values);
            console.log("index",index);
            
            return index;

        };

        var sortCols = function( cols, fixedColsCount) {

            var fixed = cols.slice(0,fixedColsCount);
            var variable = cols.slice(fixedColsCount);
            variable = _.sortBy( variable, "text");
            var sortedCols = _.union( fixed,variable);
            return sortedCols;

        };

        var headerIndex = createHeaderIndex(cols, this.fixedCols);
        var sortedCols = sortCols(cols,this.fixedCols);

        var that = this;
        // Ext.Array.each(cols, function(col, index) {
        Ext.Array.each(sortedCols, function(col, index) { 
            if (col.hidden != true) {
                // fix the issue with the "SYLK" warning in excel by prepending "Item" to the ID column
                var colLabel = (index === 0 ? "Item " : "") + col.text;
                colLabel = colLabel.replace(/<br\/?>/,'');
                data += that._getFieldTextAndEscape(colLabel) + ',';
            }
        });
        data += "\n";

        _.each( store.data.items, function(record) {

            // Ext.Array.each(cols, function(col, index) {
            Ext.Array.each(sortedCols, function(col) {

                var index = headerIndex[col.text];
            
                if (col.hidden != true) {
                    var fieldName   = col.dataIndex;
                    var text        = record.get(fieldName);
                    data += that._getFieldTextAndEscape(text,record,col,index) + ',';
                }
            });
            data += "\n";
        });

        return data;
    },

    _ieGetGridData : function(grid, sheet) {
        var that            = this;
        var resourceItems   = grid.store.data.items;
        var cols            = grid.columns;

        Ext.Array.each(cols, function(col, colIndex) {
            if (col.hidden != true) {
                
                sheet.cells(1,colIndex + 1).value = col.text;
            }
        });

        var rowIndex = 2;
        grid.store.each(function(record) {
            var entry   = record.getData();

            Ext.Array.each(cols, function(col, colIndex) {
                if (col.hidden != true) {
                    var fieldName   = col.dataIndex;
                    var text        = entry[fieldName];
                    var value       = that._getFieldText(text);

                    sheet.cells(rowIndex, colIndex+1).value = value;
                }
            });
            rowIndex++;
        });
    },

    _ieToExcel: function (grid) {
        if (window.ActiveXObject){
            var  xlApp, xlBook;
            try {
                xlApp = new ActiveXObject("Excel.Application"); 
                xlBook = xlApp.Workbooks.Add();
            } catch (e) {
                Ext.Msg.alert('Error', 'For the export to work in IE, you have to enable a security setting called "Initialize and script ActiveX control not marked as safe" from Internet Options -> Security -> Custom level..."');
                return;
            }

            xlBook.worksheets("Sheet1").activate;
            var XlSheet = xlBook.activeSheet;
            xlApp.visible = true; 

           this._ieGetGridData(grid, XlSheet);
           XlSheet.columns.autofit; 
        }
    }
});