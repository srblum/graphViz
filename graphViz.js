function initializeData(){
    /*
      An array of sequences from the server
      Created during seqSuccess()
      Used during segmentize() to create segEndArr
    */
    seqArr=[],

    /*
      An array of joins from the server
      Created during joinSuccess()
      Used during segmentize() to create segJoinArr
    */
    joinArr=[],

    /*
      An array of [seq,pos,strand,length] arrays
      Created during subgraphSuccess
      Used during segmentizeSubgraph() to create segEndArr
    */
    segArr=[],

    /*
      Array of [seqID,pos,strand] arrays
      Filled in by segmentize() 
      Used by makeGraphable()
    */
    segEndArr=[],

    /*
      Array of [[seqID,pos,strand],[seqID,pos,strand],type,length] arrays
      Filled in by segmentize(), or by subgraphSuccess() and segmentizeSubgraph()
      Used by makeGraphable()
    */
    segJoinArr=[],

    /*
      nodeArr is an array of dicts
      Filled in by makeGraphable
      Used by cytoscape
      { data:{id:i+"",
                seq:seq,
                pos:pos,
                strand:strand,
                color:colorMap[seq],
                yPos:yMap[seq]},
        classes:""}
    */
    nodeArr=[],

    /*
      edgeArr is an array of dicts
      Filled in by makeGraphable
      Used by cytoscape
      { data:{source:segEndIdMap[sourceNode],
              target:segEndIdMap[targetNode],
              sourceData:sourceNode,
              targetData:targetNode,
              type:type,
              length:length},
        classes:type}
      Note that sourceNode and targetNode are [seqID,pos,strand] arrays
      corresponding to segEnds.
    */
    edgeArr=[],

    /*
      Maps [seqID,pos,strand] arrays to node ID integers
      Created and used in makeGraphable() to connect edges to nodes
    */
    segEndIDMap={},

    /*
      Filled in by alleleIDSuccess
      and used by alleleSuccess to fill in alleleDict
      
      [0,1,2]
    */
    alleleIDArr=[];

    /*
      alleleDict is a dict of dicts
      Created during alleleSuccess
      Used by highlightPath
      {
        'ref':
        {
          1:[[0,3],[5,9],[20,50],[80,200]]
          2:[[0,5],[10,20]]
          3:[[0,0]]
        },
        'alt1':
        {
          1:[[0,100],[80,200]]
          2:[[0,5],[10,20]]
          3:[[0,0]]
        },
        etc...
      }
    */
    alleleDict={};

    /*
      The url of the server.
    */
    url='';


    //POST request data
    refRequest={
          "accessions": [],
          "assemblyId": null,
          "md5checksums": [],
          "pageSize": 100, 
          "pageToken": null
    },  
    seqRequest={
          "pageSize": 100, 
          "pageToken": '0', 
          "referenceSetId": null, 
          "variantSetId": null,
          "listBases":false
    },   
    joinRequest={
          "length": null, 
          "pageSize": 10000000, 
          "pageToken": '0', 
          "referenceSetId": null, 
          "sequenceId": null, 
          "start": null, 
          "strand": null, 
          "variantSetId": null
    },
    subgraphRequest={
          "position":{
            "position":0,
            "referenceName":null,
            "sequenceId":"0"
          },
          "radius":1000,
          "referenceSetId":null,
          "variantSetId":null
    },
    alleleIDRequest={
          "pageSize": 100,
          "pageToken": '0', 
          "start": 0, 
          "end": 10, 
          "sequenceId": "", 
          "variantSetIds": []
    };

}
//Endpoints
var refSetExt="v0.6.g/referencesets/search",
    seqExt="v0.6.g/sequences/search",
    joinExt="v0.6.g/joins/search",
    alleleExt="v0.6.g/alleles",
    alleleIDExt="v0.6.g/alleles/search",
    subgraphExt="v0.6.g/subgraph/extract";


//
//Start Ajax functions
//
function post_(extension,request,success,fail){
  $.ajax({
    type:"POST",
    contentType:"application/json",
    url:url+extension,
    data:JSON.stringify(request),
    success:success,
    fail:fail
  });
}

function get_(extension,success){
  return $.ajax({
    type:"GET",
    url:url+extension,
    success:success
  });
}

function refSetSuccess(data){
    var refSets=data['referenceSets'];
    try{
      seqRequest['referenceSetId']=refSets[0]['id'];
      joinRequest['referenceSetId']=refSets[0]['id'];
      console.log(refSets[0]['id']);
    }catch(err){
      seqRequest['referenceSetId']='0';
      joinRequest['referenceSetId']='0';
    }
    post_(seqExt,seqRequest,seqSuccess);
}

function seqSuccess(data){
  var nextPageToken=data['nextPageToken'];
  var sequences=data['sequences'];
  for(var i=0;i<sequences.length;i++){
    seqArr[seqArr.length]=sequences[i];
  }
  if(nextPageToken!=null){
    seqRequest['pageToken']=nextPageToken;
    post_(seqExt,seqRequest,seqSuccess);
  }else{
    post_(joinExt,joinRequest,joinSuccess);
  }
}

function joinSuccess(data){
  var nextPageToken=data['nextPageToken'];
  var joins=data['joins'];
  for(var i=0;i<joins.length;i++){
    joinArr[joinArr.length]=joins[i];
    console.log(joins[i]);
  }
  if(nextPageToken!=null){
    joinRequest['pageToken']=nextPageToken;
    post_(joinExt,joinRequest,joinSuccess);
  }else{
    addSegEndsFromSequences();
    post_(alleleIDExt,alleleIDRequest,alleleIDSuccess);
  }
}

function alleleIDSuccess(data){
  var alleles=data['alleles'];
  for(var i=0;i<alleles.length;i++){
    var allele=alleles[i],
        id_=allele['id'];
    console.log(allele);
    alleleIDArr[alleleIDArr.length]=id_;
  }
  var doneArr=[];
  for(var i=0;i<alleleIDArr.length;i++){
    doneArr[i]=0;
  }
  for(var i=0;i<alleleIDArr.length;i++){
    var alleleID=alleleIDArr[i];
    $.when(get_(alleleExt+'/'+alleleID,alleleSuccess)).done(function(a){
      doneArr[i]=1;
      if(doneArr.every(elem=>elem>=0)){
        $('#alleles')
           .empty()
           .append($("<option></option>")
           .attr("value","")
           .text("Select a path"));
        $.each(alleleDict, function(key,value){
           $('#alleles')
               .append($("<option></option>")
               .attr("value",key)
               .text(key));
        });
      }
    });
  }
}


function alleleSuccess(data){
  var path=data['path'],
      segments=path['segments'],
      id=parseInt(data['id']),
      variantSetId=data['variantSetId'],
      name=data['name'],
      allelePathItemArr=[];
  var segRangeMap={};
  for(var i=0;i<segments.length;i++){
    var segment=segments[i],
        start=segment['start'],
        strand=start['strand'],
        length=parseInt(segment['length']),
        base=start['base'],
        pos=parseInt(base['position']),
        seqID=parseInt(base['sequenceId']),
        end=strand=='POS_STRAND'?pos+length-1:pos-length+1,
        range=[pos,end].sort(function(a,b){return a-b});
    if(!segRangeMap[seqID]){
      segRangeMap[seqID]=[range];
    }else{
      segRangeMap[seqID][segRangeMap[seqID].length]=range;
    }
  }
  alleleDict[name]=segRangeMap;
}

function subgraphSuccess(data){
  console.log("Subgraph success.")
  var joins=data['joins'],
      segments=data['segments'];
  for(var i in joins){
    joinArr[joinArr.length]=joins[i];
    console.log(joins[i]);
  }
  for(var i in segments){
    var seg=segments[i],
        length=seg['length'],
        start=seg['start'],
        base=start['base'],
        strand=start['strand'],
        pos=base['position'],
        seq=base['sequenceId'];
    console.log(seg);
    segArr[segArr.length]=[seq,pos,strand,length];
  }
  post_(alleleIDExt,alleleIDRequest,alleleIDSuccess);
  addSegEndsFromSegments();
}

function subgraphFail(data){
  console.log("fail");
}
//
//End Ajax Functions
//


//
//Start Data wrangling Functions
//
function addSegEndsFromSequences(){
  //Add all the starting segEnds and internal segJoins
  for(var i=0;i<seqArr.length;i++){
    var length=parseInt(seqArr[i]['length']),
        seqId=seqArr[i]['id'];
    segEndArr[segEndArr.length]=[seqId,0,'POS_STRAND']
    segEndArr[segEndArr.length]=[seqId,length-1,'NEG_STRAND']
    segJoinArr[segJoinArr.length]=[[seqId,0,'POS_STRAND'],[seqId,length-1,'NEG_STRAND'],'internal',length]
  }
  segmentize();
}

function addSegEndsFromSegments(){
  for(var i in segArr){
    var seg=segArr[i],
        seq=seg[0],
        pos=parseInt(seg[1]),
        strand=seg[2],
        length=parseInt(seg[3]),
        pos1=strand=='POS_STRAND'?pos:pos-length+1,
        pos2=strand=='POS_STRAND'?pos+length-1:pos;
    segEndArr[segEndArr.length]=[seq,pos1,'POS_STRAND'];
    segEndArr[segEndArr.length]=[seq,pos2,'NEG_STRAND'];
    segJoinArr[segJoinArr.length]=[[seq,pos1,'POS_STRAND'],[seq,pos2,'NEG_STRAND'],'internal',length];
  }
  segmentize();
}



function segmentize(){
  //Whenever a join connects to a non-existent segEnd
  //add two segEnds (and an implicit segJoin)
  //and split the internal segJoin spanning the segEnds into two internal segJoins
  //then add the explicit segJoin
  for(var i=0;i<joinArr.length;i++){
    var twoSides=['side1','side2'],
        join={'side1':null,'side2':null};
    for(var j=0;j<2;j++){
      var side=joinArr[i][twoSides[j]],
          seqId=side['base']['sequenceId'],
          pos=parseInt(side['base']['position']),
          strand=side['strand'],
          segEnd=[seqId,pos,strand];
      join[twoSides[j]]=segEnd;
      //If one of the segEnds is not in segEndArr, add two segEnds, an implicit segJoin,
      //and split an internal segJoin
      if(!arrayInArray(segEnd,segEndArr)){
        //Add the segEnd
        segEndArr[segEndArr.length]=segEnd;
        //Add the other segEnd and the implicit segJoin between the two segEnds
        if(strand=='POS_STRAND'){
          segEndArr[segEndArr.length]=[seqId,pos-1,'NEG_STRAND'];
          segJoinArr[segJoinArr.length]=[segEnd,[seqId,pos-1,'NEG_STRAND'],'implicit',0];
        }else{
          segEndArr[segEndArr.length]=[seqId,pos+1,'POS_STRAND'];
          segJoinArr[segJoinArr.length]=[segEnd,[seqId,pos+1,'POS_STRAND'],'implicit',0];
        }
        //Split internal segJoins that go through this position into two
        for(var k=0;k<segJoinArr.length;k++){
          var oldSegJoin=segJoinArr[k],
              oldSegEnd1=oldSegJoin[0],
              oldSegEnd2=oldSegJoin[1],
              oldType=oldSegJoin[2],
              oldSeqId=oldSegEnd1[0],
              oldStart=oldSegEnd1[1],
              oldEnd=oldSegEnd2[1];
          //the newPos variable is to cause old internal segJoins to be split
          //by joins going to the internal side of the first or last base of the segment
          var newPos=(strand=='NEG_STRAND')?pos+0.5:pos-0.5;
          if(oldType=='internal' && oldSeqId==seqId && oldStart<newPos && oldEnd>newPos){
            //instead of deleting during iteration, just change type and ignore later
            segJoinArr[k][2]='obsolete';
            if(strand=='NEG_STRAND'){
              segJoinArr[segJoinArr.length]=[[seqId,oldStart,'POS_STRAND'],[seqId,pos,'NEG_STRAND'],'internal',pos-oldStart+1];
              segJoinArr[segJoinArr.length]=[[seqId,pos+1,'POS_STRAND'],[seqId,oldEnd,'NEG_STRAND'],'internal',oldEnd-pos];
            }else{
              segJoinArr[segJoinArr.length]=[[seqId,oldStart,'POS_STRAND'],[seqId,pos-1,'NEG_STRAND'],'internal',pos-oldStart];
              segJoinArr[segJoinArr.length]=[[seqId,pos,'POS_STRAND'],[seqId,oldEnd,'NEG_STRAND'],'internal',oldEnd-pos+1];
            }
          }
        }
      }
    }
    //Finally, add the join to segJoinArr
    var seq1 = join['side1'][0],
        seq2 = join['side2'][0];
    segJoinArr[segJoinArr.length]=[join['side1'],join['side2'],'explicit',0];
    //Also, if the join is between two sides on the same sequence, add another 'invisible' join
    if(seq1==seq2){
      segJoinArr[segJoinArr.length]=[join['side1'],join['side2'],'invisible',0];
    }
  }
  makeGraphable();
}


//Takes the data in segEndArr and segJoinArr
//Puts it in nodeArr and edgeArr so it can be graphed
function makeGraphable(){
  for(var i=0;i<segEndArr.length;i++){
    var segEnd=segEndArr[i],
        seq=segEnd[0],
        pos=segEnd[1],
        strand=segEnd[2];
    nodeArr[nodeArr.length]=
        { data:{id:i+"",
                seq:seq,
                pos:pos,
                strand:strand},
          classes:""
        }
    segEndIDMap[[seq,pos,strand]]=i+"";
  }
  for(var i=0;i<segJoinArr.length;i++){
    var segJoin=segJoinArr[i],
        sourceNode=segJoin[0],
        targetNode=segJoin[1],
        type=segJoin[2],
        length=segJoin[3];
    if(type!='obsolete'){
      edgeArr[edgeArr.length]=
          { data:{source:segEndIDMap[sourceNode],
                  target:segEndIDMap[targetNode],
                  sourceData:sourceNode,
                  targetData:targetNode,
                  type:type,
                  length:length},
            classes:type};
    }
  }
  draw();
}

//
//End Data wrangling Functions
//



//
//Start Utility functions
//
function arrayInArray(testArray,containerArray){
  var inArray=false;
  for(var i=0;i<containerArray.length;i++){
    var innerArray=containerArray[i];
    if(arrayEquals(testArray,innerArray)){
      return true;
    }
  }
  return false;
}

function arrayEquals(array1,array2){
  if(array1.length!=array2.length){
    return false;
  }
  for(var i=0;i<array1.length;i++){
    if(array1[i]!=array2[i]){
      return false;
    }
  }
  return true;
}
//
//End Utility functions
//




//
//Start viz functions
//
function draw(){
  cy=cytoscape({
    container:document.getElementById('cy'),

    layout:{
      name: 'preset',
      positions: undefined, // map of (node id) => (position obj); or function(node){ return somPos; }
    },

    boxSelectionEnabled:true,
    
    style: cytoscape.stylesheet()
      .selector('edge.implicit')
        .css({
          'line-color':'blue',
          'line-style':'dotted',
          'width':1
        })
      .selector('edge.explicit')
        .css({
          'line-color':'orange',
          'width':1,
          'z-index':1,
          'control-point-step-size':120
        })
      .selector('edge.internal')
        .css({
          'line-color':'grey',
          'width':10,
          'line-style':'solid',
          'content':'data(length)',
          'color':'white',
          'edge-text-rotation':'autorotate',
          'font-size':'12'
        })
      .selector('edge.highlighted')
        .css({
          'line-color':'blue',
          'width':10,
          'line-style':'solid',
          'content':'data(length)',
          'color':'white',
          'edge-text-rotation':'autorotate',
          'font-size':'12'
        })
      .selector('edge.invisible')
        .css({
          'visibility':'hidden'
        })
      .selector('node')
        .css({
          'background-color':'grey',
          'shape':'rectangle',
          'width':4,
          'height':15
        })
      .selector('node.highlighted')
        .css({
          'background-color':'blue',
          'shape':'rectangle',
          'width':4,
          'height':15
        }),
    
    elements: {
      nodes: nodeArr,
      edges: edgeArr
    },

    ready: function(){
      var mainSeq=positionMainSeq();
      positionConnectedSeqs(mainSeq);
      cy.fit();
    }

  });

  cy.on('mouseover','node', function(event){
    var target = event.cyTarget,
        id = target.data("id"),
        seq = target.data("seq"),
        pos = target.data("pos"),
        strand = (target.data("strand")=='POS_STRAND'?'+':'-');

    var x=event.cyRenderedPosition.x;
    var y=event.cyRenderedPosition.y;   

    var text="<strong>Sequence:</strong> "+seq+"<BR><strong>Position:</strong> "+pos+"<BR><strong>Strand:</strong> "+strand;

    showTooltip(text,x,y);             
  });

  cy.on('mouseout','node',function(event){
    d3.selectAll("#tooltip").remove();
  });

  cy.on('click','node',function(event){
    var target = event.cyTarget,
        seq = target.data("seq"),
        pos = target.data("pos");
    $('#seq').val(seq);
    $('#pos').val(pos);
  });
}

function positionMainSeq(){
      console.log("Positioning main seq...");

      //seqIDCountDict is used to determine the mainSeq, the seq with the most segEnds
      var seqIDCountDict={},
          viewportHeight=cy.height(),
          viewportWidth=cy.width();

      //Count segEnds in each sequence and store them in seqIDCountDict
      for(var i in segEndArr){
        var segEnd=segEndArr[i],
            seqID=segEnd[0];
        if(!(seqID in seqIDCountDict)){
          seqIDCountDict[seqID]=1;
        }else{
          seqIDCountDict[seqID]+=1;
        }
      }
      //Find the sequence in seqIDCountDict with the most segEnds and call it mainSeq
      var maxCount=0;
      for(var key in seqIDCountDict){
        var count=seqIDCountDict[key];
        if (count>maxCount){
          maxCount=count;
          mainSeq=key;
        }
      }
      //Place all mainSeq internal segJoins in segJoinArr in mainInternalArr
      var mainInternalArr=[];
      for(var i in segJoinArr){
        var segJoin=segJoinArr[i],
            startNode=segJoin[0],
            endNode=segJoin[1],
            type=segJoin[2],
            length=segJoin[3];
        if(type=='internal' && startNode[0]==mainSeq){
          mainInternalArr[mainInternalArr.length]=segJoin;
        }
      }
      //Sort mainInternalArr
      mainInternalArr.sort(function(a,b){
        var baseA=a[0][1],
            baseB=b[0][1];
        return baseA-baseB;
      });
      //Iterate through mainInternalArr, incrementing an x coordinate
      //And position each cytoscape node according to that position, using
      //segEndIDMap to acquire their IDs from [seq,pos,strand] arrays
      var yPos=viewportHeight/2,
          xPos=10;
      for(var i in mainInternalArr){
        var segJoin=mainInternalArr[i],
            startSeg=segJoin[0],
            endSeg=segJoin[1],
            length=segJoin[3];
        //Get node IDs from segEndIDMap
        var startNodeID=segEndIDMap[startSeg],
            endNodeID=segEndIDMap[endSeg],
            startNode=cy.getElementById(startNodeID),
            endNode=cy.getElementById(endNodeID);
        startNode.position({x:xPos,y:yPos});
        xPos+=(length+'').length*15;
        endNode.position({x:xPos,y:yPos});
        xPos+=10;
      }
      return mainSeq;
}

function positionConnectedSeqs(mainSeq){
      console.log("Positiong connected seqs...");
      //Create a dict, seqDict, mapping each non-main sequence to an array of its internal segJoins
      var seqDict={},
          viewportHeight=cy.height();

      for(var i in segJoinArr){
        var segJoin=segJoinArr[i],
            startSeg=segJoin[0],
            seq=startSeg[0],
            type=segJoin[2];
        if(type=='internal'){
          if(seq!=mainSeq){
            if(!(seq in seqDict)){
              seqDict[seq]=[segJoin];
            }else{
              seqDict[seq][seqDict[seq].length]=segJoin;
            }
          }
        }
      }
      //Sort each array of segJoins (value) in seqDict
      for(var seq in seqDict){
        // console.log(seq,seqDict[seq]);
        seqDict[seq].sort(function(a,b){
          var startA=a[0][1],
              startB=b[0][1];
          return startA-startB;
        });
      }

      //For each seq in seqDict:
      //  find the total rendered length of that sequence (currently digits in length*15+implicit joins*10)
      //
      //  find an appropriate x position xPos around which to center the nodes in that sequence, based
      //  on the positions of the nodes that the nodes in that sequence are attached to.
      //
      //  find an appropriate y position yPos to place the nodes in the sequence.  This must determine if
      //  any nodes have already been positioned in the intended y-interval using yPosIntervalDict.
      //  if any nodes already have been positioned there, place the nodes in the next available yPos for that interval.
      var yPosIntervalDict={1:[],2:[],3:[],4:[],5:[],6:[],7:[],8:[],9:[],10:[],11:[],12:[],13:[],14:[],15:[],16:[]},
          yLayerOffsetDict={1:20,2:40,3:60,4:80,5:100,6:120,7:140,8:160,9:180,10:200,11:220,12:240,13:260,14:280,15:300,16:320},
          positionedArr=[mainSeq];

      for(var seq in seqDict){
        if($.inArray(seq,positionedArr)==-1){
          //Find the positions of the nodes to which the ends of this sequence are joined by explicit joins
          //Average their positions and use that x-Coordinate as the center x-Coordinate of this sequence
          var pos1=null,
              pos2=null,
              centerXPos=null,
              joinedAt=null;
          for(var i in seqDict[seq]){
            if(!pos1){
              var segJoin=seqDict[seq][i],
                  startSide=segJoin[0],
                  startNodeID=segEndIDMap[startSide],
                  startNode=cy.getElementById(startNodeID);
              startNode.connectedEdges().each(function(i,edge){
                var data=edge.data(),
                    type=data['type'],
                    sourceID=data['source'],
                    targetID=data['target'];
                if(type=='explicit'){
                  var otherNodeID=(startNodeID==targetID)? sourceID:targetID,
                      otherNode=cy.getElementById(otherNodeID),
                      otherNodeSeq=otherNode.data('seq');
                  if($.inArray(otherNodeSeq, positionedArr)>-1){
                    pos1=otherNode.position();
                  }
                }
              })
            }
            if(!pos2){
              var segJoin=seqDict[seq][i],
                  endSide=segJoin[1],
                  endNodeID=segEndIDMap[endSide],
                  endNode=cy.getElementById(endNodeID);
              endNode.connectedEdges().each(function(i,edge){
                var data=edge.data(),
                    type=data['type'],
                    sourceID=data['source'],
                    targetID=data['target'];
                if(type=='explicit'){
                  var otherNodeID=(endNodeID==targetID)? sourceID:targetID,
                      otherNode=cy.getElementById(otherNodeID),
                      otherNodeSeq=otherNode.data('seq');
                  if($.inArray(otherNodeSeq, positionedArr)>-1){
                    pos2=otherNode.position();
                  }
                }
              })
            }
            if(pos1 && pos2){
              if('x' in pos1 && 'x' in pos2){
                var x1=pos1['x'],
                    x2=pos2['x'],
                    centerXPos=(x1+x2)/2,
                    joinedAt='both';
              }else if('x' in pos1){
                var centerXPos=pos1['x'],
                    joinedAt='both';
              }else if('x' in pos2){
                var centerXPos=pos2['x'],
                    joinedAt='both';
              }
              break;
            }else if(pos2){
              if('x' in pos2){
                var centerXPos=pos2['x'],
                    joinedAt='end';
              }
              break;
            }else if(pos1){
              if('x' in pos1){
                var centerXPos=pos1['x'],
                    joinedAt='start';
              }
              break;
            }
          }
          if(centerXPos){
            //Find total rendered length of the sequence, renderedSeqLength
            var renderedSeqLength=0;
            for(var i in seqDict[seq]){
              var segJoin=seqDict[seq][i],
                  length=segJoin[3];
              renderedSeqLength+=(length+'').length*15
            }
            renderedSeqLength+=(seqDict[seq].length-1)*10
            //Modify centerXPos if seq is only attached at start or end
            if(joinedAt=='start'){
              centerXPos+=renderedSeqLength/2;
            }else if(joinedAt=='end'){
              centerXPos-=renderedSeqLength/2;
            }
            //Determine the y-layer in which to place the sequence by looking for overlap in yPosIntervalDict
            var xStart=centerXPos-renderedSeqLength/2,
                xEnd=centerXPos+renderedSeqLength/2,
                yOffset=null;
            for(var yLayer in yPosIntervalDict){
              var intervalArr=yPosIntervalDict[yLayer],
                  inArr=false;
              for(var i in intervalArr){
                var interval=intervalArr[i],
                    startInterval=interval[0],
                    endInterval=interval[1];
                if((xEnd>=startInterval && xEnd<=endInterval)||(xStart>=startInterval && xStart<=endInterval)||(xStart<=startInterval && xEnd>=endInterval)){
                  inArr=true;
                }
              }
              if(!inArr){
                yOffset=yLayerOffsetDict[yLayer];
                yPosIntervalDict[yLayer][yPosIntervalDict[yLayer].length]=[xStart-5,xEnd+5]
                break;
              }
            }

            //One at a time, position each of the nodes in the sequence using centerXPos, renderedSeqLength, and yPosIntervalDict
            var xPos=centerXPos-renderedSeqLength/2-10;
            for(var i in seqDict[seq]){
              var segJoin=seqDict[seq][i],
                  startSide=segJoin[0],
                  endSide=segJoin[1],
                  length=segJoin[3],
                  startNodeID=segEndIDMap[startSide],
                  endNodeID=segEndIDMap[endSide],
                  startNode=cy.getElementById(startNodeID),
                  endNode=cy.getElementById(endNodeID);
              xPos+=10
              startNode.position({'x':xPos,'y':viewportHeight/2+yOffset});
              xPos+=(length+'').length*15;
              endNode.position({'x':xPos,'y':viewportHeight/2+yOffset});
            }
            positionedArr[positionedArr.length]=seq;
          }
        }
      }
}

function showTooltip(text,xPos,yPos){
      //Update the tooltip position and value
      d3.select('#cy').append('div')
        .attr('id','tooltip')
        .style("left", (xPos)+ "px")
        .style("top", (yPos)+ "px")           
        .html(text);

      //Show the tooltip
      d3.select("#tooltip").classed("hidden", false);
}

function highlightPath(name){
  var segRangeMap=alleleDict[name];
  cy.edges().each(function(i,edge){
    var data=edge.data(),
        type=data['type'];
    if(data['type']=='internal'){
      var source=data['sourceData'],
          target=data['targetData'],
          seqID=parseInt(source[0]),
          start=source[1],
          end=target[1];
      if(seqID in segRangeMap){
        var inArr=false;
        for(var i=0;i< segRangeMap[seqID].length;i++){
          var range=segRangeMap[seqID][i],
              startRange=range[0],
              endRange=range[1];
          if(start>=startRange && end<=endRange){
            inArr=true;
          }
        }
        if(inArr){
          edge.style('line-color','black');
          edge.connectedNodes().each(function(i,node){
            node.style('background-color','black');
          });
        }else{
          edge.style('line-color','grey');
          edge.connectedNodes().each(function(i,node){
            node.style('background-color','grey');
          });
        }
        
      }else{
        edge.style('line-color','grey');
        edge.connectedNodes().each(function(i,node){
          node.style('background-color','grey');
        });
      }
    }

  })
}
//
//End viz functions
//



$(function(){
  document.getElementById("subGraph").click();
});

function postSubgraph(form){
  initializeData();
  draw();
  console.log("Getting subgraph.");
  url="http://ga4gh-test1.cloudapp.net/"+form.url.value+"/";
  console.log(url);
  subgraphRequest['position']['position']=parseInt(form.pos.value);
  subgraphRequest['position']['sequenceId']=form.seq.value;
  subgraphRequest['radius']=parseInt(form.radius.value);
  post_(subgraphExt,subgraphRequest,subgraphSuccess,subgraphFail);
}

function postGraph(form){
  initializeData();
  draw();
  url="http://ga4gh-test1.cloudapp.net/"+form.url.value+"/";
  post_(refSetExt,refRequest,refSetSuccess);
}