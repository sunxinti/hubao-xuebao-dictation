const {test}=require('node:test');const assert=require('node:assert/strict');
const {PET,CARD,petPosition,cardBounds}=require('../src/overlay-layout.cjs');
test('dictation card uses the pet right side when there is room',()=>{
 const area={x:0,y:25,width:1440,height:850},pet={x:800,y:600};
 const b=cardBounds(pet,area);assert.equal(b.x,pet.x+PET.width+6);assert.equal(b.width,CARD.width);
});
test('right-edge and secondary displays keep the entire card on the same screen',()=>{
 for(const area of [{x:0,y:25,width:1440,height:850},{x:-1920,y:-200,width:1920,height:1080},{x:1440,y:0,width:320,height:240}]){
  for(const point of [{x:area.x,y:area.y},{x:area.x+area.width,y:area.y+area.height}]){
   const pet=petPosition(point,area),b=cardBounds(pet,area);
   assert.ok(b.x>=area.x&&b.y>=area.y);assert.ok(b.x+b.width<=area.x+area.width);assert.ok(b.y+b.height<=area.y+area.height);
  }
 }
});
