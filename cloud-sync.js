/* MPMFIT — sincronización de nutrición y progreso físico.
   Requiere la tabla public.user_app_state descrita en docs/user-app-state.sql.
   Las fotos de progreso siguen siendo locales (IndexedDB) en esta versión. */
(function(){
  const TABLE='user_app_state';
  let syncTimer=null, syncPromise=Promise.resolve(), syncing=false;
  const defaults=()=>({nutrition:{goal:'maintenance',targets:{kcal:0,protein:0,carbs:0,fat:0},entries:[],favorites:[],savedMeals:[],recipes:[],mealPlans:[],quantityMemory:{}},bodyweight:[],bodymeasure:[],bodyweight_goal:null});
  const userId=()=>typeof currentUser!=='undefined'&&currentUser?currentUser.id:null;
  const key=(kind,id=userId())=>{
    if(!id)return null;
    return ({nutrition:'mpmfit_nutrition_v1_'+id,bodyweight:'mpmfit_bodyweight_v1_'+id,bodymeasure:'mpmfit_bodymeasure_v1_'+id,goal:'mpmfit_bodyweight_goal_v1_'+id})[kind];
  };
  const metaKey=()=> 'mpmfit_app_state_sync_v1_'+userId();
  function readJson(k,fallback){try{const v=JSON.parse(localStorage.getItem(k));return v===null?fallback:v}catch(e){return fallback}}
  function readLocal(){
    const n=readJson(key('nutrition'),null);
    return {
      nutrition:n&&typeof n==='object'?{...defaults().nutrition,...n,targets:{...defaults().nutrition.targets,...(n.targets||{})},entries:Array.isArray(n.entries)?n.entries:[],favorites:Array.isArray(n.favorites)?n.favorites:[],savedMeals:Array.isArray(n.savedMeals)?n.savedMeals:[],recipes:Array.isArray(n.recipes)?n.recipes:[],mealPlans:Array.isArray(n.mealPlans)?n.mealPlans:[],quantityMemory:n.quantityMemory&&typeof n.quantityMemory==='object'?n.quantityMemory:{}}:defaults().nutrition,
      bodyweight:Array.isArray(readJson(key('bodyweight'),[]))?readJson(key('bodyweight'),[]):[],
      bodymeasure:Array.isArray(readJson(key('bodymeasure'),[]))?readJson(key('bodymeasure'),[]):[],
      bodyweight_goal:localStorage.getItem(key('goal'))===null?null:Number(localStorage.getItem(key('goal')))
    };
  }
  function hasLocalState(){
    return ['nutrition','bodyweight','bodymeasure','goal'].some(k=>localStorage.getItem(key(k))!==null);
  }
  function saveLocal(state){
    localStorage.setItem(key('nutrition'),JSON.stringify(state.nutrition||defaults().nutrition));
    localStorage.setItem(key('bodyweight'),JSON.stringify(Array.isArray(state.bodyweight)?state.bodyweight:[]));
    localStorage.setItem(key('bodymeasure'),JSON.stringify(Array.isArray(state.bodymeasure)?state.bodymeasure:[]));
    if(state.bodyweight_goal===null||state.bodyweight_goal===undefined)localStorage.removeItem(key('goal'));
    else localStorage.setItem(key('goal'),String(state.bodyweight_goal));
    if(typeof loadNutritionData==='function')loadNutritionData();
    if(typeof renderNutrition==='function'&&document.getElementById('nutrition'))renderNutrition();
    if(typeof renderBodyWeight==='function')renderBodyWeight();
    if(typeof renderBodyMeasurements==='function')renderBodyMeasurements();
    if(typeof renderBodyWeightGoal==='function')renderBodyWeightGoal();
  }
  function mergeArray(remote=[],local=[]){
    const map=new Map();
    for(const item of remote.concat(local)){
      const identity=item&&item.id?String(item.id):JSON.stringify(item);
      map.set(identity,item);
    }
    return [...map.values()];
  }
  function mergeState(remote,local){
    const n=local.nutrition||defaults().nutrition, r=remote.nutrition||defaults().nutrition;
    const localHasNutrition=(n.entries||[]).length||(n.favorites||[]).length||(n.savedMeals||[]).length||(n.recipes||[]).length||(n.mealPlans||[]).length||n.goal!=='maintenance'||Object.values(n.targets||{}).some(v=>Number(v)>0);
    const mergedNutrition={
      ...r,...n,
      goal:localHasNutrition?n.goal:r.goal,
      targets:localHasNutrition?n.targets:r.targets,
      entries:mergeArray(r.entries||[],n.entries||[]),
      favorites:mergeArray(r.favorites||[],n.favorites||[]),
      savedMeals:mergeArray(r.savedMeals||[],n.savedMeals||[]),
      recipes:mergeArray(r.recipes||[],n.recipes||[]),
      mealPlans:mergeArray(r.mealPlans||[],n.mealPlans||[]),
      quantityMemory:{...(r.quantityMemory||{}),...(n.quantityMemory||{})}
    };
    const byDate=(a,b)=>{const map=new Map();(a||[]).forEach(x=>map.set(x.date,x));(b||[]).forEach(x=>map.set(x.date,{...(map.get(x.date)||{}),...x}));return [...map.values()].sort((x,y)=>String(x.date).localeCompare(String(y.date)))};
    return {
      nutrition:mergedNutrition,
      bodyweight:byDate(remote.bodyweight,local.bodyweight),
      bodymeasure:byDate(remote.bodymeasure,local.bodymeasure),
      bodyweight_goal:local.bodyweight_goal!==null&&Number.isFinite(local.bodyweight_goal)?local.bodyweight_goal:remote.bodyweight_goal??null
    };
  }
  function hasMeaningfulData(s){
    return (s.nutrition?.entries||[]).length||(s.nutrition?.favorites||[]).length||(s.nutrition?.savedMeals||[]).length||(s.nutrition?.recipes||[]).length||(s.nutrition?.mealPlans||[]).length||(s.bodyweight||[]).length||(s.bodymeasure||[]).length||s.bodyweight_goal!==null;
  }
  function payload(s,uid){
    return {user_id:uid,nutrition:s.nutrition||defaults().nutrition,bodyweight:s.bodyweight||[],bodymeasure:s.bodymeasure||[],bodyweight_goal:s.bodyweight_goal??null,updated_at:new Date().toISOString()};
  }
  function setStatus(label){if(typeof setSyncStatus==='function')setSyncStatus(label)}
  async function readRemote(uid){
    const {data,error}=await supabaseClient.from(TABLE).select('user_id,nutrition,bodyweight,bodymeasure,bodyweight_goal,updated_at').eq('user_id',uid).maybeSingle();
    if(error)throw error;return data;
  }
  async function writeRemote(uid,state,expectedUpdatedAt){
    const row=payload(state,uid);
    if(expectedUpdatedAt){
      const {data,error}=await supabaseClient.from(TABLE).update({nutrition:row.nutrition,bodyweight:row.bodyweight,bodymeasure:row.bodymeasure,bodyweight_goal:row.bodyweight_goal,updated_at:row.updated_at}).eq('user_id',uid).eq('updated_at',expectedUpdatedAt).select('updated_at').maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('Los datos de nutrición o progreso cambiaron en otro dispositivo. Se han conservado los datos de este equipo; vuelve a sincronizar antes de seguir editando.');
      return data.updated_at;
    }
    const {data,error}=await supabaseClient.from(TABLE).insert(row).select('updated_at').single();
    if(error)throw error;return data.updated_at;
  }
  async function syncNow(){
    const uid=userId();if(!uid||typeof cloudReady==='undefined'||!cloudReady)return;
    if(syncing)return;
    syncing=true;
    try{
      const local=readLocal(),meta=readJson(metaKey(),null),remote=await readRemote(uid);
      if(!remote){
        const updatedAt=await writeRemote(uid,local,null);
        localStorage.setItem(metaKey(),JSON.stringify({updatedAt,dirty:false}));
        setStatus('● SINCRONIZADO');return;
      }
      if(!meta){
        const merged=hasLocalState()?mergeState(remote,local):remote;
        if(hasLocalState()&&hasMeaningfulData(local)){
          const updatedAt=await writeRemote(uid,merged,remote.updated_at);
          saveLocal(merged);localStorage.setItem(metaKey(),JSON.stringify({updatedAt,dirty:false}));
        }else{
          saveLocal(remote);localStorage.setItem(metaKey(),JSON.stringify({updatedAt:remote.updated_at,dirty:false}));
        }
        setStatus('● SINCRONIZADO');return;
      }
      if(meta.dirty){
        if(meta.updatedAt!==remote.updated_at){
          setStatus('● CONFLICTO DE DATOS');
          if(typeof toast==='function')toast('Hay cambios en otro dispositivo. Tus datos locales se conservan; no se ha sobrescrito nada.');
          return;
        }
        const updatedAt=await writeRemote(uid,local,remote.updated_at);
        localStorage.setItem(metaKey(),JSON.stringify({updatedAt,dirty:false}));
      }else if(meta.updatedAt!==remote.updated_at){
        saveLocal(remote);localStorage.setItem(metaKey(),JSON.stringify({updatedAt:remote.updated_at,dirty:false}));
      }
      setStatus('● SINCRONIZADO');
    }catch(error){
      console.error('MPMFIT app-state sync:',error);
      setStatus('● ERROR NUTRICIÓN/PROGRESO');
      if(typeof toast==='function')toast('No se ha podido sincronizar nutrición/progreso. Tus datos locales siguen guardados.');
    }finally{syncing=false}
  }
  function markDirty(){
    const uid=userId();if(!uid)return;
    const meta=readJson(metaKey(),null);
    localStorage.setItem(metaKey(),JSON.stringify({updatedAt:meta?.updatedAt||null,dirty:true}));
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{syncPromise=syncPromise.then(syncNow)},700);
  }
  window.MPMFitCloudSync={syncNow,markDirty};
  window.syncUserAppData=syncNow;
})();
