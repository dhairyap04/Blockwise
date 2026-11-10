/** Keep one complete street layer visible while its replacement loads. */
export class StreetLayer {
  constructor(load, notify, limit=72) {
    this.load=load;this.notify=notify;this.limit=limit;
    this.cache=new Map();this.pending=new Map();this.visible=[];this.requested=[];
    this.generation=0;this.disposed=false;
  }
  async update(tiles) {
    if(this.disposed || !tiles.length)return;
    const generation=++this.generation;this.requested=tiles;
    this.notify(this.visible,"Updating visible streets…");
    const results=await Promise.allSettled(tiles.map(tile=>{
      if(this.cache.has(tile.id))return this.cache.get(tile.id);
      if(this.pending.has(tile.id))return this.pending.get(tile.id);
      const request=this.load(tile).then(texture=>{
        this.pending.delete(tile.id);
        if(this.disposed){texture.dispose();return;}
        this.cache.set(tile.id,texture);return texture;
      },error=>{this.pending.delete(tile.id);throw error;});
      this.pending.set(tile.id,request);return request;
    }));
    if(this.disposed)return;
    if(generation===this.generation) {
      const failed=results.filter(r=>r.status==='rejected').length;
      // Never replace a complete view with holes. An initial failed load may
      // show available tiles, with an explicit retry instead of a silent blank.
      if(!failed || !this.visible.length)this.visible=tiles.filter(t=>this.cache.has(t.id));
      this.notify(this.visible,failed ? `${failed} street tiles unavailable. ${this.visible.length ? 'Keeping loaded streets visible. ' : ''}Buildings and filters still work.` : '');
    }
    const protectedIds=new Set([...this.visible,...this.requested].map(t=>t.id));
    for(const [id,texture] of this.cache) {
      if(this.cache.size<=this.limit)break;
      if(!protectedIds.has(id)){texture.dispose();this.cache.delete(id);}
    }
  }
  dispose() {
    this.disposed=true;this.generation++;
    this.cache.forEach(texture=>texture.dispose());this.cache.clear();
  }
}
