'use strict';
const PET={width:200,height:204};
const CARD={width:350,height:294};
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(n,Math.max(lo,hi)));
function petSize(scale=1){return {width:Math.round(PET.width*scale),height:Math.round(PET.height*scale)};}
function petPosition(point,area,scale=1){
 const size=petSize(scale);
 return {x:clamp(Math.round(point.x),area.x,area.x+area.width-size.width),y:clamp(Math.round(point.y),area.y,area.y+area.height-size.height)};
}
function cardBounds(pet,area){
 const width=Math.min(CARD.width,area.width),height=Math.min(CARD.height,area.height),gap=6;
 const right=pet.x+(pet.width??PET.width)+gap;
 const x=right+width<=area.x+area.width?right:pet.x-width-gap;
 return {x:clamp(x,area.x,area.x+area.width-width),y:clamp(pet.y+(pet.height??PET.height)-height,area.y,area.y+area.height-height),width,height};
}
module.exports={PET,CARD,petSize,petPosition,cardBounds};
