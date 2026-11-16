// MPMFIT Nutrition — diario manual y consulta de códigos de barras.
// Los datos se guardan localmente y quedan aislados por cuenta. La sincronización cloud
// de nutrición se incorporará cuando se apruebe y pruebe su esquema independiente.
let nutritionData={goal:'maintenance',targets:{kcal:0,protein:0,carbs:0,fat:0},entries:[],favorites:[],savedMeals:[],recipes:[]};
let barcodeStream=null,barcodeFrame=null;
let nutritionAddLocked=false,barcodeLookupInProgress=false,barcodeCameraStarting=false,currentFoodUnit=null;
function nutritionStorageKey(){return 'mpmfit_nutrition_v1_'+(currentUser?.id||'guest')}
function loadNutritionData(){
 try{
  const saved=JSON.parse(localStorage.getItem(nutritionStorageKey()));
  nutritionData=saved&&Array.isArray(saved.entries)?{goal:saved.goal||'maintenance',targets:saved.targets||{kcal:0,protein:0,carbs:0,fat:0},entries:saved.entries,favorites:Array.isArray(saved.favorites)?saved.favorites:[],savedMeals:Array.isArray(saved.savedMeals)?saved.savedMeals:[],recipes:Array.isArray(saved.recipes)?saved.recipes:[],mealPlans:Array.isArray(saved.mealPlans)?saved.mealPlans:[],quantityMemory:saved.quantityMemory&&typeof saved.quantityMemory==='object'?saved.quantityMemory:{}}:{goal:'maintenance',targets:{kcal:0,protein:0,carbs:0,fat:0},entries:[],favorites:[],savedMeals:[],recipes:[],mealPlans:[],quantityMemory:{}};
 }catch(e){nutritionData={goal:'maintenance',targets:{kcal:0,protein:0,carbs:0,fat:0},entries:[],favorites:[],savedMeals:[],recipes:[],mealPlans:[],quantityMemory:{}}}
}
function saveNutritionData(){localStorage.setItem(nutritionStorageKey(),JSON.stringify(nutritionData));if(window.MPMFitCloudSync)window.MPMFitCloudSync.markDirty()}
function nutritionToday(){return document.getElementById('nutritionDate')?.value||new Date().toISOString().slice(0,10)}
function nutritionNumber(id){return Math.max(0,Number(document.getElementById(id)?.value)||0)}
function nutritionGoalName(goal){return ({bulk:'Volumen',cut:'Definición',maintenance:'Mantenimiento'})[goal]||'Mantenimiento'}
function nutritionTotals(date){
 return nutritionData.entries.filter(e=>e.date===date).reduce((a,e)=>{a.kcal+=e.kcal;a.protein+=e.protein;a.carbs+=e.carbs;a.fat+=e.fat;return a},{kcal:0,protein:0,carbs:0,fat:0});
}
function nutritionProgress(label,value,target,unit){
 const pct=target>0?Math.min(100,value/target*100):0;
 return '<div class="card stat"><span>'+label+'</span><b>'+Math.round(value*10)/10+' <small>'+unit+'</small></b><span>'+(target>0?'Objetivo: '+target+' '+unit:'Objetivo sin configurar')+'</span><div class="barwrap"><div class="bar" style="width:'+pct+'%"></div></div></div>';
}
function nutritionTargetCard(label,value,unit){return '<div class="card stat"><span>'+label+'</span><b>'+(value||'—')+' <small>'+unit+'</small></b><span>Objetivo diario</span></div>'}
function renderNutrition(){
 if(!document.getElementById('nutritionDate'))return;
 if(!document.getElementById('nutritionDate').value)document.getElementById('nutritionDate').value=new Date().toISOString().slice(0,10);
 const t=nutritionData.targets||{},goal=document.getElementById('nutritionGoalsView');
 goal.innerHTML='<div class="card stat"><span>Objetivo</span><b style="font-size:20px">'+nutritionGoalName(nutritionData.goal)+'</b></div>'+nutritionTargetCard('Calorías',t.kcal,'kcal')+nutritionTargetCard('Proteínas',t.protein,'g')+nutritionTargetCard('Hidratos',t.carbs,'g')+nutritionTargetCard('Grasas',t.fat,'g');
 const totals=nutritionTotals(nutritionToday());
 document.getElementById('nutritionSummary').innerHTML=nutritionProgress('Calorías consumidas',totals.kcal,t.kcal||0,'kcal')+nutritionProgress('Proteínas',totals.protein,t.protein||0,'g')+nutritionProgress('Hidratos',totals.carbs,t.carbs||0,'g')+nutritionProgress('Grasas',totals.fat,t.fat||0,'g');
 const entries=nutritionData.entries.filter(e=>e.date===nutritionToday());
 const meals=['Desayuno','Media mañana','Comida','Merienda','Cena','Otros'];
 document.getElementById('nutritionDiary').innerHTML=entries.length?meals.map(meal=>{
  const items=entries.filter(e=>e.meal===meal);
  return items.length?'<div class="history-item"><div class="row"><strong>'+meal+'</strong><button class="btn ghost small" onclick="saveNutritionMeal(\''+meal+'\')">Guardar comida</button></div>'+items.map(e=>'<div class="row" style="padding:8px 0;gap:8px"><div><strong>'+esc(e.name)+'</strong><div class="hint">'+nutritionEntryQuantity(e)+' · '+Math.round(e.kcal)+' kcal · P '+e.protein.toFixed(1)+' g · HC '+e.carbs.toFixed(1)+' g · G '+e.fat.toFixed(1)+' g</div></div><div style="display:flex;gap:6px;flex-shrink:0"><button class="btn ghost small" title="Añadir a favoritos" onclick="toggleNutritionFavorite(\''+e.id+'\')">'+(nutritionData.favorites.some(x=>x.sourceId===e.id||x.name===e.name)?'★':'☆')+'</button><button class="btn secondary small" onclick="editNutritionEntry(\''+e.id+'\')">Editar</button><button class="btn danger small" onclick="deleteNutritionEntry(\''+e.id+'\')">×</button></div></div>').join('')+'</div>':'';
 }).join(''):'<div class="empty">Todavía no has añadido alimentos para este día.</div>';
 renderNutritionLibrary();
 renderNutritionPlanner();
 renderNutritionHistory();
 renderNutritionQuick();
}
function toggleNutritionGoals(show){
 const form=document.getElementById('nutritionGoalsForm'),visible=show===undefined?form.style.display==='none':show;
 form.style.display=visible?'block':'none';
 if(visible){
  document.getElementById('nutritionGoal').value=nutritionData.goal||'maintenance';
  const t=nutritionData.targets||{};
  document.getElementById('nutritionKcal').value=t.kcal||'';
  document.getElementById('nutritionProtein').value=t.protein||'';
  document.getElementById('nutritionCarbs').value=t.carbs||'';
  document.getElementById('nutritionFat').value=t.fat||'';
 }
}
function saveNutritionGoals(){
 const kcal=nutritionNumber('nutritionKcal'),protein=nutritionNumber('nutritionProtein'),carbs=nutritionNumber('nutritionCarbs'),fat=nutritionNumber('nutritionFat');
 if(!kcal||!protein||!carbs||!fat){toast('Completa calorías y los tres macronutrientes con valores mayores que cero');return}
 nutritionData.goal=document.getElementById('nutritionGoal').value;
 nutritionData.targets={kcal,protein,carbs,fat};
 saveNutritionData();toggleNutritionGoals(false);renderNutrition();toast('Objetivos nutricionales guardados');
}
function nutritionEntryQuantity(entry){
 const labels={g:'g',ml:'ml',unit:Math.abs(entry.amount)===1?'unidad':'unidades',portion:Math.abs(entry.amount)===1?'ración':'raciones'};
 const amount=Number(entry.amount??entry.grams)||0;
 return (Number.isInteger(amount)?amount:amount.toLocaleString(getMPMFITLocale(),{maximumFractionDigits:2}))+' '+(labels[entry.unit]||entry.unit||'g');
}
function nutritionFoodValues(){return ['foodKcal','foodProtein','foodCarbs','foodFat'].map(id=>Number(document.getElementById(id)?.value))}
function renderFoodPreview(){
 const preview=document.getElementById('foodNutritionPreview');if(!preview)return;
 const amount=Number(document.getElementById('foodGrams')?.value),unit=document.getElementById('foodUnit')?.value||'g';
 const values=nutritionFoodValues();
 if(!Number.isFinite(amount)||amount<=0||values.some(v=>!Number.isFinite(v)||v<0)||!document.getElementById('foodKcal')?.value){preview.textContent='Introduce una cantidad y los valores nutricionales para ver el cálculo.';return}
 const factor=(unit==='g'||unit==='ml')?amount/100:amount,totals=values.map(v=>v*factor);
 preview.innerHTML='<strong>Esta cantidad aporta:</strong> '+Math.round(totals[0])+' kcal · Proteínas '+totals[1].toFixed(1)+' g · Hidratos '+totals[2].toFixed(1)+' g · Grasas '+totals[3].toFixed(1)+' g';
}
function addNutritionEntry(item){
 const amount=Math.max(0.01,Number(item.amount)||0),factor=item.basis==='100g'||item.basis==='100ml'?amount/100:amount;
 const normalized=normalizeNutritionSearch(item.name);nutritionData.quantityMemory=nutritionData.quantityMemory||{};nutritionData.quantityMemory[normalized]={amount,unit:item.unit,basis:item.basis};
 nutritionData.entries.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),date:nutritionToday(),meal:document.getElementById('foodMeal').value,name:item.name,amount,unit:item.unit,basis:item.basis,kcal:item.kcal*factor,protein:item.protein*factor,carbs:item.carbs*factor,fat:item.fat*factor,barcode:item.barcode||null});
 saveNutritionData();renderNutrition();toast('Alimento añadido al diario');
}
function updateFoodUnitUI(){
 const unit=document.getElementById('foodUnit')?.value||'g';
 if(currentFoodUnit&&currentFoodUnit!==unit){
  ['foodKcal','foodProtein','foodCarbs','foodFat'].forEach(id=>{const field=document.getElementById(id);if(field)field.value=''});
  const barcode=document.getElementById('foodBarcode');if(barcode)delete barcode.dataset.lastBarcode;
  const result=document.getElementById('barcodeResult');if(result)result.textContent='Has cambiado la unidad. Introduce los valores nutricionales correspondientes a la nueva referencia.';
 }
 currentFoodUnit=unit;
 const basis=document.getElementById('foodBasis');
 const amountLabel=document.getElementById('foodAmountLabel');
 if(basis){
  const options={g:[['100g','Por 100 g']],ml:[['100ml','Por 100 ml']],unit:[['unit','Por unidad']],portion:[['portion','Por ración']]};
  basis.innerHTML=options[unit].map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('');
 }
 if(amountLabel)amountLabel.textContent=({g:'Cantidad (g)',ml:'Cantidad (ml)',unit:'Cantidad (unidades)',portion:'Cantidad (raciones)'})[unit];
 const hint=document.getElementById('foodReferenceHint');
 if(hint)hint.textContent=({g:'Introduce los valores nutricionales por cada 100 g (etiqueta del producto).',ml:'Introduce los valores por cada 100 ml. No uses valores por 100 g para un registro en ml.',unit:'Introduce los valores correspondientes a una unidad (por ejemplo, un huevo).',portion:'Introduce los valores correspondientes a una ración completa.'})[unit];
 renderFoodPreview();
}

function addManualFood(){
 if(nutritionAddLocked)return;
 const name=document.getElementById('foodName').value.trim();
 if(!name){toast('Escribe el nombre del alimento');return}
 const values=['foodKcal','foodProtein','foodCarbs','foodFat'].map(n=>Number(document.getElementById(n).value));
 if(values.some(v=>!Number.isFinite(v)||v<0)||!document.getElementById('foodKcal').value){toast('Introduce calorías y macros según la referencia seleccionada');return}
 const amount=Number(document.getElementById('foodGrams').value),unit=document.getElementById('foodUnit').value,basis=document.getElementById('foodBasis').value;
 if(!Number.isFinite(amount)||amount<=0){toast('Introduce una cantidad válida');return}
 const compatible={g:'100g',ml:'100ml',unit:'unit',portion:'portion'};
 if(compatible[unit]!==basis){toast('La unidad y la referencia nutricional no coinciden');return}
 nutritionAddLocked=true;
 const button=document.querySelector('button[onclick="addManualFood()"]');
 if(button){button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Añadiendo…'}
 try{addNutritionEntry({name,amount,unit,basis,kcal:values[0],protein:values[1],carbs:values[2],fat:values[3]})}
 finally{setTimeout(()=>{nutritionAddLocked=false;if(button){button.disabled=false;button.textContent=button.dataset.originalText||'＋ Añadir al diario'}},700)}
}
function fillFoodForm(product,barcode){
 document.getElementById('foodName').value=product.name||'Producto sin nombre';
 document.getElementById('foodGrams').value=nutritionRememberedAmount(name,'g');
 document.getElementById('foodUnit').value='g';updateFoodUnitUI();
 document.getElementById('foodKcal').value=product.kcal??'';
 document.getElementById('foodProtein').value=product.protein??'';
 document.getElementById('foodCarbs').value=product.carbs??'';
 document.getElementById('foodFat').value=product.fat??'';
 renderFoodPreview();
 document.getElementById('barcodeResult').innerHTML='Producto encontrado: '+esc(product.name||'Sin nombre')+(product.brand?' · '+esc(product.brand):'')+'. <button class="btn small" style="margin-top:8px" onclick="addBarcodeFoodNow()">＋ Añadir ahora</button><div class="hint">Comprueba los datos del envase.</div>';
 document.getElementById('foodBarcode').dataset.lastBarcode=barcode;
}
async function lookupBarcode(code){
 if(barcodeLookupInProgress)return;
 const barcode=String(code||document.getElementById('foodBarcode').value).trim();
 if(!/^[0-9]{8,14}$/.test(barcode)){toast('Introduce un código EAN/UPC válido (8 a 14 cifras)');return}
 barcodeLookupInProgress=true;
 const button=document.querySelector('button[onclick="lookupBarcode()"]');
 if(button){button.disabled=true;button.dataset.originalText=button.textContent;button.textContent='Buscando…'}
 const result=document.getElementById('barcodeResult');result.textContent='Buscando producto…';
 try{
  const response=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(barcode)+'.json?fields=product_name,product_name_es,brands,nutriments');
  if(!response.ok)throw new Error('No se ha podido consultar la base de datos');
  const data=await response.json();
  if(data.status!==1||!data.product)throw new Error('No encontramos ese código. Puedes introducir el alimento manualmente.');
  const p=data.product,n=p.nutriments||{};
  let kcal=Number(n['energy-kcal_100g']);
  if(!Number.isFinite(kcal)||kcal<=0){const kj=Number(n['energy_100g']);kcal=Number.isFinite(kj)?kj/4.184:0}
  const product={name:p.product_name_es||p.product_name||'Producto',brand:p.brands||'',kcal:kcal||0,protein:Number(n.proteins_100g)||0,carbs:Number(n.carbohydrates_100g)||0,fat:Number(n.fat_100g)||0};
  fillFoodForm(product,barcode);
  toast('Producto localizado. Comprueba la etiqueta.');
 }catch(error){result.textContent=error.message||'Error al buscar el producto';}
 finally{barcodeLookupInProgress=false;if(button){button.disabled=false;button.textContent=button.dataset.originalText||'Buscar producto'}}
}
async function startBarcodeCamera(){
 if(barcodeCameraStarting||barcodeStream)return;
 barcodeCameraStarting=true;
 if(!('BarcodeDetector' in window)){barcodeCameraStarting=false;document.getElementById('barcodeResult').textContent='Este navegador no ofrece escáner integrado. Puedes escribir el código de barras y pulsar Buscar producto.';return}
 if(!navigator.mediaDevices?.getUserMedia){barcodeCameraStarting=false;document.getElementById('barcodeResult').textContent='No se puede acceder a la cámara en este contexto. Usa HTTPS o introduce el código manualmente.';return}
 try{
  const supported=await BarcodeDetector.getSupportedFormats();
  const formats=['ean_13','ean_8','upc_a','upc_e'].filter(format=>supported.includes(format));
  if(!formats.length)throw new Error('El navegador no admite formatos EAN/UPC compatibles. Introduce el código manualmente.');
  const detector=new BarcodeDetector({formats});
  barcodeStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  const video=document.getElementById('barcodeVideo');video.srcObject=barcodeStream;await video.play();
  document.getElementById('barcodeCamera').style.display='block';
  document.getElementById('barcodeCameraStatus').textContent='Apunta al código de barras del envase';
  const scan=async()=>{
   if(!barcodeStream)return;
   try{const codes=await detector.detect(video);if(codes.length){document.getElementById('foodBarcode').value=codes[0].rawValue;stopBarcodeCamera();lookupBarcode(codes[0].rawValue);return}}catch(e){}
   barcodeFrame=requestAnimationFrame(scan);
  };
  scan();
 }catch(error){stopBarcodeCamera();document.getElementById('barcodeResult').textContent='No se pudo iniciar la cámara. Comprueba el permiso del navegador o introduce el código manualmente.'}
 finally{barcodeCameraStarting=false}
}
function stopBarcodeCamera(){
 if(barcodeFrame)cancelAnimationFrame(barcodeFrame);barcodeFrame=null;
 if(barcodeStream){barcodeStream.getTracks().forEach(t=>t.stop());barcodeStream=null}
 const video=document.getElementById('barcodeVideo');if(video)video.srcObject=null;
 const camera=document.getElementById('barcodeCamera');if(camera)camera.style.display='none';
}
function editNutritionEntry(id){
 const entry=nutritionData.entries.find(e=>e.id===id);if(!entry)return;
 const amount=Number(entry.amount??entry.grams)||1;
 const meals=['Desayuno','Media mañana','Comida','Merienda','Cena','Otros'];
 openModal('<h2>Editar alimento</h2><div class="stack"><div class="field"><label>Alimento</label><input id="nutritionEditName" value="'+esc(entry.name)+'" maxlength="120"></div><div class="field"><label>Comida</label><select id="nutritionEditMeal">'+meals.map(m=>'<option value="'+m+'" '+(entry.meal===m?'selected':'')+'>'+m+'</option>').join('')+'</select></div><div class="field"><label>Cantidad ('+esc(entry.unit||'g')+')</label><input id="nutritionEditAmount" type="number" min="0.01" step="any" value="'+amount+'" oninput="renderNutritionEditPreview(\''+id+'\')"></div><div class="card stat" id="nutritionEditPreview" aria-live="polite"></div><p class="hint">Al cambiar la cantidad, las calorías y los macros se ajustan proporcionalmente a los valores originales.</p></div><div class="modalactions"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn" onclick="saveNutritionEntryEdit(\''+id+'\')">Guardar cambios</button></div>');
 renderNutritionEditPreview(id);
}
function renderNutritionEditPreview(id){
 const entry=nutritionData.entries.find(e=>e.id===id),box=document.getElementById('nutritionEditPreview');if(!entry||!box)return;
 const oldAmount=Number(entry.amount??entry.grams)||1,newAmount=Number(document.getElementById('nutritionEditAmount')?.value);
 if(!Number.isFinite(newAmount)||newAmount<=0){box.textContent='Introduce una cantidad válida.';return}
 const ratio=newAmount/oldAmount;
 box.innerHTML='<strong>Esta cantidad aporta:</strong> '+Math.round(entry.kcal*ratio)+' kcal · Proteínas '+(entry.protein*ratio).toFixed(1)+' g · Hidratos '+(entry.carbs*ratio).toFixed(1)+' g · Grasas '+(entry.fat*ratio).toFixed(1)+' g';
}
function saveNutritionEntryEdit(id){
 const entry=nutritionData.entries.find(e=>e.id===id);if(!entry)return;
 const name=document.getElementById('nutritionEditName').value.trim(),meal=document.getElementById('nutritionEditMeal').value,amount=Number(document.getElementById('nutritionEditAmount').value);
 if(!name){toast('Escribe el nombre del alimento');return}
 if(!Number.isFinite(amount)||amount<=0){toast('Introduce una cantidad válida');return}
 const oldAmount=Number(entry.amount??entry.grams)||1,ratio=amount/oldAmount;
 entry.name=name;entry.meal=meal;entry.amount=amount;
 entry.kcal*=ratio;entry.protein*=ratio;entry.carbs*=ratio;entry.fat*=ratio;
 saveNutritionData();closeModal();renderNutrition();toast('Alimento actualizado');
}
function nutritionId(){return crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2)}
function toggleNutritionFavorite(entryId){
 const entry=nutritionData.entries.find(e=>e.id===entryId);if(!entry)return;
 const index=nutritionData.favorites.findIndex(f=>f.sourceId===entryId||normalizeNutritionSearch(f.name)===normalizeNutritionSearch(entry.name));
 if(index>=0){nutritionData.favorites.splice(index,1);toast('Favorito eliminado')}
 else{nutritionData.favorites.push({id:nutritionId(),sourceId:entry.id,name:entry.name,amount:entry.amount,unit:entry.unit,basis:entry.basis,kcal:entry.kcal,protein:entry.protein,carbs:entry.carbs,fat:entry.fat,barcode:entry.barcode||null});toast('Alimento guardado en favoritos')}
 saveNutritionData();renderNutrition();
}
function addNutritionFavorite(id){
 const f=nutritionData.favorites.find(x=>x.id===id);if(!f)return;
 const meal=document.getElementById('nutritionQuickMeal')?.value||'Comida';
 nutritionData.entries.push({...f,id:nutritionId(),sourceId:undefined,date:nutritionToday(),meal});
 saveNutritionData();renderNutrition();toast('Alimento añadido desde favoritos');
}
function saveNutritionMeal(meal){
 const entries=nutritionData.entries.filter(e=>e.date===nutritionToday()&&e.meal===meal);
 if(!entries.length)return;
 const name=prompt('Nombre para guardar esta comida:',meal+' habitual');if(!name||!name.trim())return;
 nutritionData.savedMeals.push({id:nutritionId(),name:name.trim(),meal,items:entries.map(e=>({name:e.name,amount:e.amount??e.grams??1,unit:e.unit||'g',basis:e.basis||'100g',kcal:e.kcal,protein:e.protein,carbs:e.carbs,fat:e.fat,barcode:e.barcode||null}))});
 saveNutritionData();renderNutritionLibrary();toast('Comida guardada');
}
function addSavedNutritionMeal(id){
 const saved=nutritionData.savedMeals.find(x=>x.id===id);if(!saved)return;
 const meal=document.getElementById('nutritionQuickMeal')?.value||saved.meal||'Comida';
 saved.items.forEach(item=>nutritionData.entries.push({...item,id:nutritionId(),date:nutritionToday(),meal}));
 saveNutritionData();renderNutrition();toast('Comida añadida al diario');
}
function deleteSavedNutritionMeal(id){nutritionData.savedMeals=nutritionData.savedMeals.filter(x=>x.id!==id);nutritionData.mealPlans=nutritionData.mealPlans.filter(p=>!(p.type==='meal'&&p.itemId===id));saveNutritionData();renderNutritionLibrary();renderNutritionPlanner();toast('Comida guardada eliminada')}
function createNutritionRecipe(){
 const date=nutritionToday(),entries=nutritionData.entries.filter(e=>e.date===date);
 if(entries.length<1){toast('Añade primero los ingredientes al diario del día');return}
 openModal('<h2>Crear receta</h2><div class="field"><label>Nombre de la receta</label><input id="recipeName" maxlength="100" placeholder="Ej. Arroz con pollo"></div><div class="field" style="margin-top:10px"><label>Número de raciones</label><input id="recipeServings" type="number" min="1" step="1" value="2"></div><p class="hint">Selecciona los ingredientes que forman la receta. Se utilizarán sus cantidades y macros registrados hoy.</p><div class="stack">'+entries.map(e=>'<label class="row" style="justify-content:flex-start;gap:9px;padding:8px 0"><input type="checkbox" class="recipeIngredient" value="'+esc(e.id)+'" style="width:auto"><span>'+esc(e.name)+' · '+Math.round(e.kcal)+' kcal</span></label>').join('')+'</div><div class="modalactions"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn" onclick="saveNutritionRecipe()">Crear receta</button></div>');
}
function saveNutritionRecipe(){
 const name=document.getElementById('recipeName').value.trim(),servings=Math.floor(Number(document.getElementById('recipeServings').value));
 const ids=[...document.querySelectorAll('.recipeIngredient:checked')].map(x=>x.value);
 if(!name){toast('Escribe el nombre de la receta');return}
 if(!Number.isInteger(servings)||servings<1||servings>100){toast('Indica entre 1 y 100 raciones');return}
 const ingredients=ids.map(id=>nutritionData.entries.find(e=>e.id===id)).filter(Boolean);
 if(!ingredients.length){toast('Selecciona al menos un ingrediente');return}
 const totals=ingredients.reduce((a,e)=>({kcal:a.kcal+e.kcal,protein:a.protein+e.protein,carbs:a.carbs+e.carbs,fat:a.fat+e.fat}),{kcal:0,protein:0,carbs:0,fat:0});
 nutritionData.recipes.push({id:nutritionId(),name,servings,ingredients:ingredients.map(e=>({name:e.name,amount:e.amount??e.grams??1,unit:e.unit||'g'})),totals,perServing:{kcal:totals.kcal/servings,protein:totals.protein/servings,carbs:totals.carbs/servings,fat:totals.fat/servings}});
 saveNutritionData();closeModal();renderNutritionLibrary();toast('Receta guardada');
}
function addNutritionRecipe(id){
 const r=nutritionData.recipes.find(x=>x.id===id);if(!r)return;
 const p=r.perServing||r.totals,meal=document.getElementById('nutritionQuickMeal')?.value||'Comida';
 nutritionData.entries.push({id:nutritionId(),date:nutritionToday(),meal,name:r.name+' (1 ración)',amount:1,unit:'portion',basis:'portion',kcal:p.kcal,protein:p.protein,carbs:p.carbs,fat:p.fat,recipeId:r.id});
 saveNutritionData();renderNutrition();toast('Ración de receta añadida');
}
function deleteNutritionRecipe(id){nutritionData.recipes=nutritionData.recipes.filter(x=>x.id!==id);nutritionData.mealPlans=nutritionData.mealPlans.filter(p=>!(p.type==='recipe'&&p.itemId===id));saveNutritionData();renderNutritionLibrary();renderNutritionPlanner();toast('Receta eliminada')}
function renderNutritionLibrary(){
 const root=document.getElementById('nutritionLibrary');if(!root)return;
 const favorites=nutritionData.favorites||[],savedMeals=nutritionData.savedMeals||[],recipes=nutritionData.recipes||[];
 const favHtml=favorites.length?favorites.map(f=>'<div class="catalog-item"><strong>'+esc(f.name)+'</strong><div class="hint">'+Math.round(f.kcal)+' kcal · P '+f.protein.toFixed(1)+' · HC '+f.carbs.toFixed(1)+' · G '+f.fat.toFixed(1)+'</div><button class="btn secondary small" onclick="addNutritionFavorite(\''+f.id+'\')">Añadir al diario</button></div>').join(''):'<div class="empty">Guarda alimentos del diario con ☆ para tenerlos aquí.</div>';
 const mealsHtml=savedMeals.length?savedMeals.map(m=>'<div class="catalog-item"><strong>'+esc(m.name)+'</strong><div class="hint">'+m.items.length+' alimentos · '+Math.round(m.items.reduce((a,x)=>a+x.kcal,0))+' kcal</div><div class="row" style="margin-top:8px"><button class="btn secondary small" onclick="addSavedNutritionMeal(\''+m.id+'\')">Usar comida</button><button class="btn danger small" onclick="deleteSavedNutritionMeal(\''+m.id+'\')">Eliminar</button></div></div>').join(''):'<div class="empty">Guarda un desayuno, comida o cena desde el diario.</div>';
 const recipesHtml=recipes.length?recipes.map(r=>'<div class="catalog-item"><strong>'+esc(r.name)+'</strong><div class="hint">'+r.servings+' raciones · Total '+Math.round(r.totals.kcal)+' kcal</div><div class="hint">Por ración: '+Math.round(r.perServing.kcal)+' kcal · P '+r.perServing.protein.toFixed(1)+' g · HC '+r.perServing.carbs.toFixed(1)+' g · G '+r.perServing.fat.toFixed(1)+' g</div><div class="row" style="margin-top:8px"><button class="btn secondary small" onclick="addNutritionRecipe(\''+r.id+'\')">Añadir 1 ración</button><button class="btn danger small" onclick="deleteNutritionRecipe(\''+r.id+'\')">Eliminar</button></div></div>').join(''):'<div class="empty">Crea una receta a partir de ingredientes registrados hoy.</div>';
 root.innerHTML='<div class="row" style="margin:14px 0 8px"><h3>★ Favoritos</h3></div><div class="catalog-grid">'+favHtml+'</div><div class="row" style="margin:20px 0 8px"><h3>Comidas guardadas</h3></div><div class="catalog-grid">'+mealsHtml+'</div><div class="row" style="margin:20px 0 8px"><h3>Recetas</h3><button class="btn small" onclick="createNutritionRecipe()">＋ Crear receta</button></div><div class="catalog-grid">'+recipesHtml+'</div>';
}
function addNutritionPlan(){
 const date=document.getElementById('nutritionPlanDate')?.value,meal=document.getElementById('nutritionPlanMeal')?.value,choice=document.getElementById('nutritionPlanChoice')?.value;
 if(!date||!choice){toast('Elige una fecha y una comida guardada o receta');return}
 const [type,id]=choice.split(':');
 const item=type==='meal'?nutritionData.savedMeals.find(x=>x.id===id):nutritionData.recipes.find(x=>x.id===id);
 if(!item)return;
 nutritionData.mealPlans.push({id:nutritionId(),date,meal,type,itemId:id,name:item.name});
 saveNutritionData();renderNutritionPlanner();toast('Comida planificada');
}
function removeNutritionPlan(id){nutritionData.mealPlans=nutritionData.mealPlans.filter(p=>p.id!==id);saveNutritionData();renderNutritionPlanner()}
function useNutritionPlan(id){
 const plan=nutritionData.mealPlans.find(p=>p.id===id);if(!plan)return;
 const meal=plan.meal||'Comida';
 if(plan.type==='meal'){
  const saved=nutritionData.savedMeals.find(x=>x.id===plan.itemId);if(!saved)return;
  saved.items.forEach(item=>nutritionData.entries.push({...item,id:nutritionId(),date:plan.date,meal}));
 }else{
  const recipe=nutritionData.recipes.find(x=>x.id===plan.itemId);if(!recipe)return;
  const p=recipe.perServing||recipe.totals;
  nutritionData.entries.push({id:nutritionId(),date:plan.date,meal,name:recipe.name+' (1 ración)',amount:1,unit:'portion',basis:'portion',kcal:p.kcal,protein:p.protein,carbs:p.carbs,fat:p.fat,recipeId:recipe.id});
 }
 saveNutritionData();
 const dateField=document.getElementById('nutritionDate');if(dateField)dateField.value=plan.date;
 renderNutrition();toast('Comida añadida al diario de '+plan.date);
}
function renderNutritionPlanner(){
 const root=document.getElementById('nutritionPlanner');if(!root)return;
 const date=document.getElementById('nutritionPlanDate');
 if(date&&!date.value)date.value=nutritionToday();
 const choices=[...(nutritionData.savedMeals||[]).map(x=>({value:'meal:'+x.id,label:'Comida · '+x.name})),...(nutritionData.recipes||[]).map(x=>({value:'recipe:'+x.id,label:'Receta · '+x.name}))];
 const options=choices.map(x=>'<option value="'+x.value+'">'+esc(x.label)+'</option>').join('');
 const plans=(nutritionData.mealPlans||[]).slice().sort((a,b)=>(a.date+a.meal).localeCompare(b.date+b.meal));
 const list=plans.length?plans.map(p=>'<div class="catalog-item"><div class="row"><strong>'+esc(p.name)+'</strong><span class="tag">'+new Date(p.date+'T12:00:00').toLocaleDateString(getMPMFITLocale(),{day:'2-digit',month:'short'})+' · '+esc(p.meal)+'</span></div><div class="row" style="margin-top:8px"><button class="btn secondary small" onclick="useNutritionPlan(\''+p.id+'\')">Registrar en el diario</button><button class="btn danger small" onclick="removeNutritionPlan(\''+p.id+'\')">Quitar</button></div></div>').join(''):'<div class="empty">Todavía no tienes comidas planificadas.</div>';
 root.innerHTML=choices.length?'<div class="formgrid"><div class="field"><label>Fecha</label><input type="date" id="nutritionPlanDate" value="'+(date?.value||nutritionToday())+'"></div><div class="field"><label>Comida</label><select id="nutritionPlanMeal"><option>Desayuno</option><option>Media mañana</option><option>Comida</option><option>Merienda</option><option>Cena</option></select></div><div class="field fullfield"><label>Comida guardada o receta</label><select id="nutritionPlanChoice">'+options+'</select></div></div><button class="btn" style="margin-top:10px" onclick="addNutritionPlan()">＋ Añadir al plan</button><div class="catalog-grid" style="margin-top:14px">'+list+'</div>':'<div class="empty">Guarda primero una comida o crea una receta para empezar a planificar tu semana.</div>';
}
function renderNutritionHistory(){
 const root=document.getElementById('nutritionHistory');if(!root)return;
 const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().slice(0,10)});
 const values=days.map(date=>({date,...nutritionTotals(date)}));
 const max=Math.max(1,...values.map(x=>x.kcal));
 const active=values.filter(x=>x.kcal>0),avg=active.length?active.reduce((a,x)=>a+x.kcal,0)/active.length:0,avgP=active.length?active.reduce((a,x)=>a+x.protein,0)/active.length:0,avgC=active.length?active.reduce((a,x)=>a+x.carbs,0)/active.length:0,avgF=active.length?active.reduce((a,x)=>a+x.fat,0)/active.length:0;
 root.innerHTML='<div class="grid"><div class="card stat"><span>Media de calorías</span><b>'+Math.round(avg)+' <small>kcal</small></b><span>En '+active.length+' días con registros</span></div><div class="card stat"><span>Media de proteínas</span><b>'+avgP.toFixed(1)+' <small>g</small></b></div><div class="card stat"><span>Media de hidratos</span><b>'+avgC.toFixed(1)+' <small>g</small></b></div><div class="card stat"><span>Media de grasas</span><b>'+avgF.toFixed(1)+' <small>g</small></b></div></div><div class="chartbars">'+values.map(v=>'<div class="chartcol"><div class="hint">'+Math.round(v.kcal)+'</div><div class="chartbar" style="height:'+Math.max(3,v.kcal/max*135)+'px"></div><small>'+new Date(v.date+'T12:00:00').toLocaleDateString(getMPMFITLocale(),{weekday:'short'})+'</small></div>').join('')+'</div><div class="hint">Evolución de calorías y medias de macronutrientes durante los últimos siete días. Los días sin registros aparecen a cero.</div>';
}
function deleteNutritionEntry(id){nutritionData.entries=nutritionData.entries.filter(e=>e.id!==id);saveNutritionData();renderNutrition();toast('Alimento eliminado')}
function initNutrition(){loadNutritionData();updateFoodUnitUI();if(document.getElementById('nutritionDate'))document.getElementById('nutritionDate').value=new Date().toISOString().slice(0,10);renderNutrition()}
window.addEventListener('load',()=>{if(typeof currentUser!=='undefined'&&currentUser)initNutrition()});
window.addEventListener('beforeunload',stopBarcodeCamera);

 
// Catálogo básico integrado para alimentos habituales sin marca.
const nutritionCommonFoods=[
 {name:'Arroz blanco seco',kcal:360,protein:7,carbs:80,fat:0.7},
 {name:'Arroz blanco cocido',kcal:130,protein:2.7,carbs:28.2,fat:0.3},
 {name:'Arroz integral seco',kcal:370,protein:7.5,carbs:77,fat:2.7},
 {name:'Arroz integral cocido',kcal:123,protein:2.7,carbs:25.6,fat:1},
 {name:'Pechuga de pollo cruda',kcal:120,protein:22.5,carbs:0,fat:2.6},
 {name:'Pechuga de pollo cocinada',kcal:165,protein:31,carbs:0,fat:3.6},
 {name:'Huevo entero',kcal:143,protein:12.6,carbs:0.7,fat:9.5},
 {name:'Plátano',kcal:89,protein:1.1,carbs:22.8,fat:0.3},
 {name:'Manzana',kcal:52,protein:0.3,carbs:13.8,fat:0.2},
 {name:'Avena seca',kcal:389,protein:16.9,carbs:66.3,fat:6.9},
 {name:'Patata cocida',kcal:87,protein:1.9,carbs:20.1,fat:0.1},
 {name:'Pasta seca',kcal:371,protein:13,carbs:75,fat:1.5},
 {name:'Pasta cocida',kcal:158,protein:5.8,carbs:30.9,fat:0.9},
 {name:'Salmón crudo',kcal:208,protein:20.4,carbs:0,fat:13.4},
 {name:'Leche entera',kcal:61,protein:3.2,carbs:4.8,fat:3.3},
 {name:'Yogur natural entero',kcal:61,protein:3.5,carbs:4.7,fat:3.3},
 {name:'Pan blanco',kcal:266,protein:8.9,carbs:49,fat:3.2},
 {name:'Almendras',kcal:579,protein:21.2,carbs:21.6,fat:49.9},
 {name:'Aceite de oliva',kcal:884,protein:0,carbs:0,fat:100}
].map(food=>({name:food.name,brands:'MPMFIT · valores orientativos',dataSource:'Catálogo MPMFIT',nutriments:{
 'energy-kcal_100g':food.kcal,proteins_100g:food.protein,carbohydrates_100g:food.carbs,fat_100g:food.fat
}}));
let nutritionFoodSearchResults=[];
let nutritionFoodSearchInProgress=false;
function normalizeNutritionSearch(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function renderNutritionFoodSearchResults(){
 const results=document.getElementById('nutritionFoodSearchResults');
 const status=document.getElementById('nutritionFoodSearchStatus');
 if(!nutritionFoodSearchResults.length){
  results.innerHTML='';
  status.textContent='No hemos encontrado alimentos con información nutricional suficiente. Prueba otra búsqueda o utiliza el registro manual.';
  return;
 }
 results.innerHTML=nutritionFoodSearchResults.map((p,i)=>{
  const n=p.nutriments||{},name=p.product_name_es||p.product_name||p.generic_name||p.name||'Alimento';
  let kcal=Number(n['energy-kcal_100g']);if(!Number.isFinite(kcal)||kcal<=0){const kj=Number(n['energy_100g']);kcal=Number.isFinite(kj)&&kj>0?kj/4.184:null}
  const protein=Number(n.proteins_100g),carbs=Number(n.carbohydrates_100g),fat=Number(n.fat_100g);
  const valid=v=>Number.isFinite(v)&&v>=0;
  const details=[valid(kcal)?Math.round(kcal)+' kcal':'kcal —',valid(protein)?'P '+protein+' g':'P —',valid(carbs)?'HC '+carbs+' g':'HC —',valid(fat)?'G '+fat+' g':'G —'].join(' · ');
  return '<div class="catalog-item"><strong>'+esc(name)+'</strong><small>'+esc(p.brands||p.dataSource||p.quantity||'Alimento')+'</small><div class="hint">'+details+' por 100 g</div><div class="quick-actions" style="margin-top:9px"><button class="btn small" onclick="quickAddNutritionFood('+i+')">＋ Añadir</button><button class="btn ghost small" onclick="selectNutritionFood('+i+')">Cantidad</button></div></div>';
 }).join('');
 status.textContent='Resultados encontrados: '+nutritionFoodSearchResults.length+'. Selecciona el alimento correcto. Los valores del catálogo básico son orientativos.';
}
async function searchNutritionFoods(){
 if(nutritionFoodSearchInProgress)return;
 const query=(document.getElementById('nutritionFoodSearch')?.value||'').trim();
 const status=document.getElementById('nutritionFoodSearchStatus');
 const results=document.getElementById('nutritionFoodSearchResults');
 if(query.length<2){status.textContent='Escribe al menos 2 caracteres para buscar.';results.innerHTML='';return}
 nutritionFoodSearchInProgress=true;
 const button=document.getElementById('nutritionFoodSearchButton');
 if(button){button.disabled=true;button.textContent='Buscando…'}
 status.textContent='Buscando alimentos…';results.innerHTML='';
 const normalized=normalizeNutritionSearch(query);
 const localMatches=nutritionCommonFoods.filter(p=>normalizeNutritionSearch(p.name).includes(normalized));
 try{
  const params=new URLSearchParams({search_terms:query,search_simple:'1',action:'process',json:'1',page_size:'12',fields:'code,product_name,product_name_es,generic_name,brands,quantity,nutriments'});
  const response=await fetch('https://world.openfoodfacts.org/cgi/search.pl?'+params.toString());
  if(!response.ok)throw new Error('No se ha podido consultar la base de productos.');
  const data=await response.json();
  const products=Array.isArray(data.products)?data.products:[];
  const hasValue=value=>value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
  const externalMatches=products.filter(p=>{
   const n=p.nutriments||{};
   const hasEnergy=hasValue(n['energy-kcal_100g'])||hasValue(n['energy_100g']);
   return (p.product_name_es||p.product_name||p.generic_name)&&hasEnergy&&
    hasValue(n.proteins_100g)&&hasValue(n.carbohydrates_100g)&&hasValue(n.fat_100g);
  }).map(p=>({...p,dataSource:'Open Food Facts'}));
  const localNames=new Set(localMatches.map(p=>normalizeNutritionSearch(p.name)));
  nutritionFoodSearchResults=[...localMatches,...externalMatches.filter(p=>!localNames.has(normalizeNutritionSearch(p.product_name_es||p.product_name||p.generic_name)))].slice(0,12);
 }catch(error){
  nutritionFoodSearchResults=localMatches;
  if(!localMatches.length){status.textContent=error.message||'Error al buscar alimentos. Puedes introducirlo manualmente.';return}
  status.textContent='No se ha podido consultar Open Food Facts; mostramos los alimentos del catálogo integrado.';
 }
 finally{nutritionFoodSearchInProgress=false;if(button){button.disabled=false;button.textContent='Buscar alimento'}}
 renderNutritionFoodSearchResults();
}
function selectNutritionFood(index){
 const advanced=document.getElementById('nutritionAdvanced');if(advanced)advanced.open=true;
 const p=nutritionFoodSearchResults[index];if(!p)return;
 const n=p.nutriments||{};
 let kcal=Number(n['energy-kcal_100g']);
 if(!Number.isFinite(kcal)||kcal<=0){const kj=Number(n['energy_100g']);kcal=Number.isFinite(kj)&&kj>0?kj/4.184:0}
 const protein=Number(n.proteins_100g),carbs=Number(n.carbohydrates_100g),fat=Number(n.fat_100g);
 const name=p.product_name_es||p.product_name||p.generic_name||p.name||'Alimento';
 document.getElementById('foodName').value=name;
 document.getElementById('foodUnit').value='g';updateFoodUnitUI();
 document.getElementById('foodBasis').value='100g';
 document.getElementById('foodGrams').value=nutritionRememberedAmount(name,'g');
 document.getElementById('foodKcal').value=Number.isFinite(kcal)?Math.max(0,kcal).toFixed(1):'';
 document.getElementById('foodProtein').value=Number.isFinite(protein)?Math.max(0,protein).toFixed(1):'';
 document.getElementById('foodCarbs').value=Number.isFinite(carbs)?Math.max(0,carbs).toFixed(1):'';
 document.getElementById('foodFat').value=Number.isFinite(fat)?Math.max(0,fat).toFixed(1):'';
 document.getElementById('foodBarcode').value=p.code||'';
 renderFoodPreview();
 document.getElementById('barcodeResult').textContent='Alimento cargado. Revisa los valores, especialmente si son orientativos, y ajusta la cantidad antes de añadirlo.';
 document.getElementById('nutritionFoodSearchStatus').textContent='Seleccionado: '+name+'. Ahora indica la cantidad que has comido y pulsa «Añadir al diario».';
 document.getElementById('foodGrams').focus();
 document.getElementById('foodGrams').select();
}

 
// Registro rápido: cantidades recordadas, recientes, favoritos y repetición del día anterior.
function nutritionRememberedAmount(name,unit='g'){
 const saved=nutritionData.quantityMemory?.[normalizeNutritionSearch(name)];
 return saved&&saved.unit===unit?Number(saved.amount)||100:100;
}
function nutritionQuickMealValue(){return document.getElementById('nutritionQuickMeal')?.value||'Comida'}
function quickAddNutritionFood(index){
 const p=nutritionFoodSearchResults[index];if(!p)return;
 const n=p.nutriments||{};let kcal=Number(n['energy-kcal_100g']);
 if(!Number.isFinite(kcal)||kcal<=0){const kj=Number(n['energy_100g']);kcal=Number.isFinite(kj)&&kj>0?kj/4.184:0}
 const protein=Number(n.proteins_100g),carbs=Number(n.carbohydrates_100g),fat=Number(n.fat_100g);
 if(![kcal,protein,carbs,fat].every(v=>Number.isFinite(v)&&v>=0)){selectNutritionFood(index);return}
 const name=p.product_name_es||p.product_name||p.generic_name||p.name||'Alimento';
 const amount=nutritionRememberedAmount(name,'g');
 document.getElementById('foodMeal').value=nutritionQuickMealValue();
 addNutritionEntry({name,amount,unit:'g',basis:'100g',kcal,protein,carbs,fat,barcode:p.code||null});
}
function addRecentNutritionEntry(id){
 const entry=nutritionData.entries.find(e=>e.id===id);if(!entry)return;
 nutritionData.entries.push({...entry,id:nutritionId(),date:nutritionToday(),meal:nutritionQuickMealValue()});
 saveNutritionData();renderNutrition();toast('Añadido de nuevo');
}
function addQuickFavorite(id){
 const f=nutritionData.favorites.find(x=>x.id===id);if(!f)return;
 document.getElementById('foodMeal').value=nutritionQuickMealValue();
 addNutritionFavorite(id);
}
function renderNutritionQuick(){
 const fav=document.getElementById('nutritionQuickFavorites'),recent=document.getElementById('nutritionRecent');
 if(!fav||!recent)return;
 const favorites=nutritionData.favorites||[];
 fav.innerHTML=favorites.length?favorites.slice(0,8).map(f=>'<div class="quick-food"><div><strong>'+esc(f.name)+'</strong><div class="hint">'+Math.round(f.kcal)+' kcal · '+nutritionEntryQuantity(f)+'</div></div><button class="btn small" onclick="addQuickFavorite(\''+f.id+'\')">＋</button></div>').join(''):'<div class="empty">Tus favoritos aparecerán aquí. Pulsa ☆ en cualquier alimento del diario.</div>';
 const seen=new Set(),items=[];
 [...nutritionData.entries].reverse().forEach(e=>{const key=normalizeNutritionSearch(e.name);if(!seen.has(key)){seen.add(key);items.push(e)}});
 const latest=items.slice(0,8);
 recent.innerHTML=latest.length?'<div style="grid-column:1/-1"><h3>Recientes</h3></div>'+latest.map(e=>'<div class="quick-food"><div><strong>'+esc(e.name)+'</strong><div class="hint">'+nutritionEntryQuantity(e)+' · '+Math.round(e.kcal)+' kcal</div></div><button class="btn secondary small" onclick="addRecentNutritionEntry(\''+e.id+'\')">＋ Añadir</button></div>').join(''):'';
}
function repeatYesterdayNutrition(){
 const today=nutritionToday(),d=new Date(today+'T12:00:00');d.setDate(d.getDate()-1);
 const yesterday=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const source=nutritionData.entries.filter(e=>e.date===yesterday);
 if(!source.length){toast('Ayer no hay comidas registradas');return}
 if(nutritionData.entries.some(e=>e.date===today&&e.copiedFromDate===yesterday)){toast('Ya has repetido las comidas de ayer');return}
 if(!confirm('¿Copiar '+source.length+' alimentos de ayer a hoy?'))return;
 source.forEach(e=>nutritionData.entries.push({...e,id:nutritionId(),date:today,copiedFromDate:yesterday}));
 saveNutritionData();renderNutrition();toast('Comidas de ayer copiadas');
}
function openNutritionScanner(){
 const advanced=document.getElementById('nutritionAdvanced');if(advanced)advanced.open=true;
 document.getElementById('foodBarcode')?.scrollIntoView({behavior:'smooth',block:'center'});
 startBarcodeCamera();
}
function addBarcodeFoodNow(){
 const name=document.getElementById('foodName')?.value.trim();if(!name)return;
 const values=['foodKcal','foodProtein','foodCarbs','foodFat'].map(id=>Number(document.getElementById(id)?.value));
 if(values.some(v=>!Number.isFinite(v)||v<0)||!document.getElementById('foodKcal')?.value){toast('Este producto no tiene datos nutricionales suficientes');return}
 const barcode=document.getElementById('foodBarcode')?.dataset.lastBarcode||'';
 document.getElementById('foodMeal').value=nutritionQuickMealValue();
 addNutritionEntry({name,amount:nutritionRememberedAmount(name,'g'),unit:'g',basis:'100g',kcal:values[0],protein:values[1],carbs:values[2],fat:values[3],barcode});
}


// Seguimiento del peso corporal, almacenado por separado para cada cuenta.
function bodyWeightStorageKey(){return 'mpmfit_bodyweight_v1_'+(currentUser?.id||'guest')}
function getBodyWeightEntries(){
 try{const data=JSON.parse(localStorage.getItem(bodyWeightStorageKey())||'[]');return Array.isArray(data)?data.filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)&&Number.isFinite(Number(x.weight))):[]}
 catch(e){return []}
}
function syncProgressUnitInputs(){
 const mass=typeof getMPMFITPreference==='function'?getMPMFITPreference('mass'):'kg',length=typeof getMPMFITPreference==='function'?getMPMFITPreference('length'):'cm';
 const weightLabel=document.querySelector('label[for="bodyWeightValue"]')||document.getElementById('bodyWeightValue')?.closest('.field')?.querySelector('label');
 if(weightLabel)weightLabel.textContent='Tu peso ('+mass+')';
 const goalLabel=document.querySelector('label[for="bodyWeightGoal"]')||document.getElementById('bodyWeightGoal')?.closest('.field')?.querySelector('label');
 if(goalLabel)goalLabel.textContent='Objetivo de peso ('+mass+')';
 ['bodyWeightValue','bodyWeightGoal'].forEach(id=>{const el=document.getElementById(id);if(el){el.min=mass==='lb'?(20*2.2046226218).toFixed(1):'20';el.max=mass==='lb'?(400*2.2046226218).toFixed(1):'400'}})
 const measureLabels={measureWaist:'Cintura',measureChest:'Pecho',measureArm:'Brazo',measureThigh:'Muslo'};
 Object.entries(measureLabels).forEach(([id,label])=>{const el=document.getElementById(id);if(el){const l=el.closest('.field')?.querySelector('label');if(l)l.textContent=label+' ('+length+')';el.min=length==='in'?(1/2.54).toFixed(2):'1';el.max=length==='in'?(300/2.54).toFixed(1):'300'}})
}
function renderBodyWeight(){
 syncProgressUnitInputs();
 const dateInput=document.getElementById('bodyWeightDate'),valueInput=document.getElementById('bodyWeightValue');
 if(!dateInput||!valueInput)return;
 if(!dateInput.value){const now=new Date();dateInput.value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')}
 const entries=getBodyWeightEntries().sort((a,b)=>a.date.localeCompare(b.date));
 const summary=document.getElementById('bodyWeightSummary'),chart=document.getElementById('bodyWeightChart'),history=document.getElementById('bodyWeightHistory');
 if(!entries.length){summary.innerHTML='<div class="empty">Todavía no has registrado tu peso. Añade la primera medición para empezar a ver tu evolución.</div>';chart.innerHTML='';history.innerHTML='';return}
 const latest=entries[entries.length-1],previous=entries.length>1?entries[entries.length-2]:null,delta=previous?latest.weight-previous.weight:null;
 const massUnit=typeof getMPMFITPreference==='function'?getMPMFITPreference('mass'):'kg',displayMass=v=>(massUnit==='lb'?Number(v)*2.2046226218:Number(v)).toFixed(1);const deltaText=delta===null?'Primer registro':(delta>0?'+':'')+displayMass(delta)+' '+massUnit+' respecto al registro anterior';
 summary.innerHTML='<div class="grid"><div class="card stat"><span>Último peso</span><b>'+displayMass(latest.weight)+' <small>'+massUnit+'</small></b><span>'+new Date(latest.date+'T12:00:00').toLocaleDateString(getMPMFITLocale(),{day:'numeric',month:'short',year:'numeric'})+'</span></div><div class="card stat"><span>Cambio desde la medición anterior</span><b>'+(delta===null?'—':(delta>0?'+':'')+displayMass(delta))+' <small>'+(delta===null?'':massUnit)+'</small></b><span>'+deltaText+'</span></div></div>';
 const points=entries.slice(-14),min=Math.min(...points.map(x=>Number(x.weight))),max=Math.max(...points.map(x=>Number(x.weight))),range=Math.max(1,max-min),w=640,h=190,pad=30;
 const coords=points.map((x,i)=>({x:points.length===1?w/2:pad+i*(w-2*pad)/(points.length-1),y:pad+(max-Number(x.weight)+range*.12)/(range*1.24)*(h-2*pad),weight:Number(x.weight),date:x.date}));
 const poly=coords.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 chart.innerHTML='<h3>Evolución del peso</h3><div class="hint">Últimos '+points.length+' registros · No te obsesiones con las variaciones de un solo día.</div><svg class="weight-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Gráfico de evolución del peso corporal"><line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+(w-pad)+'" y2="'+(h-pad)+'" stroke="currentColor" opacity=".2"/><polyline points="'+poly+'" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+coords.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4" fill="var(--green)"><title>'+(typeof formatAppMass==='function'?formatAppMass(p.weight):p.weight.toFixed(1)+' kg')+' · '+p.date+'</title></circle>').join('')+'</svg><div class="row" style="justify-content:space-between"><small class="hint">'+points[0].date+'</small><small class="hint">'+points[points.length-1].date+'</small></div>';
 history.innerHTML='<h3 style="margin-top:18px">Registros recientes</h3>'+entries.slice().reverse().slice(0,6).map(x=>'<div class="weight-history-row"><div><strong>'+(typeof formatAppMass==='function'?formatAppMass(x.weight):Number(x.weight).toFixed(1)+' kg')+'</strong><div class="hint">'+new Date(x.date+'T12:00:00').toLocaleDateString(getMPMFITLocale(),{weekday:'short',day:'numeric',month:'short',year:'numeric'})+'</div></div><button class="btn ghost small" onclick="deleteBodyWeight(\''+x.id+'\')">Eliminar</button></div>').join('');
}
function saveBodyWeight(){
 const date=document.getElementById('bodyWeightDate')?.value,raw=document.getElementById('bodyWeightValue')?.value,inputWeight=Number(String(raw||'').replace(',','.')),weight=typeof appMassToKg==='function'?appMassToKg(inputWeight):inputWeight;
 if(!date||!raw||!Number.isFinite(weight)||weight<20||weight>400){toast('Introduce una fecha y un peso válido');return}
 const entries=getBodyWeightEntries(),existing=entries.find(x=>x.date===date);
 if(existing){if(!confirm('Ya existe un peso para ese día. ¿Quieres sustituirlo?'))return;existing.weight=weight}
 else entries.push({id:typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),date,weight});
 localStorage.setItem(bodyWeightStorageKey(),JSON.stringify(entries));if(window.MPMFitCloudSync)window.MPMFitCloudSync.markDirty();document.getElementById('bodyWeightValue').value='';renderBodyWeight();renderBodyWeightGoal();toast('Peso guardado');
}
function deleteBodyWeight(id){
 const entries=getBodyWeightEntries().filter(x=>x.id!==id);localStorage.setItem(bodyWeightStorageKey(),JSON.stringify(entries));if(window.MPMFitCloudSync)window.MPMFitCloudSync.markDirty();renderBodyWeight();toast('Registro eliminado');
}

// Seguimiento de perímetros corporales.

function bodyMeasureStorageKey(){return 'mpmfit_bodymeasure_v1_'+(currentUser?.id||'guest')}
function getBodyMeasureEntries(){try{const data=JSON.parse(localStorage.getItem(bodyMeasureStorageKey())||'[]');return Array.isArray(data)?data.filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)):[]}catch(e){return []}}
function renderBodyMeasurements(){
 syncProgressUnitInputs();
 const dateInput=document.getElementById('bodyMeasureDate'),summary=document.getElementById('bodyMeasureSummary'),history=document.getElementById('bodyMeasureHistory');if(!dateInput||!summary||!history)return;
 if(!dateInput.value){const now=new Date();dateInput.value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')}
 const labels={waist:'Cintura',chest:'Pecho',arm:'Brazo',thigh:'Muslo'},entries=getBodyMeasureEntries().sort((a,b)=>a.date.localeCompare(b.date));
 if(!entries.length){summary.innerHTML='<div class="empty">Aún no hay medidas guardadas. Puedes empezar por la cintura o registrar solo las que te interesen.</div>';history.innerHTML='';return}
 const latest=entries[entries.length-1],previous=entries.length>1?entries[entries.length-2]:null;
 summary.innerHTML='<div class="grid">'+Object.entries(labels).filter(([key])=>Number.isFinite(Number(latest[key]))&&latest[key]!==null).map(([key,label])=>{const old=previous&&Number.isFinite(Number(previous[key]))?Number(previous[key]):null,now=Number(latest[key]),delta=old===null?null:now-old;return '<div class="measure-stat"><span class="hint">'+label+'</span><b>'+(typeof formatAppLength==='function'?formatAppLength(now):now.toFixed(1)+' cm')+'</b><span class="hint">'+(delta===null?'Sin comparación anterior':(delta>0?'+':'')+(typeof formatAppLength==='function'?formatAppLength(delta):delta.toFixed(1)+' cm')+' desde el registro anterior')+'</span></div>'}).join('')+'</div><div class="hint" style="margin-top:8px">Última medición: '+new Date(latest.date+'T12:00:00').toLocaleDateString(getMPMFITLocale(),{day:'numeric',month:'long',year:'numeric'})+'</div>';
 const metric=document.getElementById('bodyMeasureMetric')?.value||'waist',metricLabels={waist:'Cintura',chest:'Pecho',arm:'Brazo',thigh:'Muslo',bodyFat:'Grasa corporal'},points=entries.filter(x=>Number.isFinite(Number(x[metric]))&&x[metric]!==null).slice(-12);
 const chartBox=document.getElementById('bodyMeasureChart');if(chartBox){if(!points.length)chartBox.innerHTML='<div class="hint">Todavía no hay registros de '+metricLabels[metric].toLowerCase()+'.</div>';else{const vals=points.map(x=>Number(x[metric])),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(.5,max-min),w=640,h=170,pad=28,coords=points.map((x,i)=>({x:points.length===1?w/2:pad+i*(w-2*pad)/(points.length-1),y:pad+(max-Number(x[metric])+range*.12)/(range*1.24)*(h-2*pad),v:Number(x[metric]),date:x.date})),poly=coords.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');chartBox.innerHTML='<h3>'+metricLabels[metric]+' · evolución</h3><svg class="weight-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Evolución de '+metricLabels[metric]+'"><line x1="'+pad+'" y1="'+(h-pad)+'" x2="'+(w-pad)+'" y2="'+(h-pad)+'" stroke="currentColor" opacity=".2"/><polyline points="'+poly+'" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'+coords.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="var(--green)"><title>'+(metric==='bodyFat'?p.v.toFixed(1)+' %':(typeof formatAppLength==='function'?formatAppLength(p.v):p.v.toFixed(1)+' cm'))+' · '+p.date+'</title></circle>').join('')+'</svg><div class="row" style="justify-content:space-between"><small class="hint">'+points[0].date+'</small><small class="hint">'+points[points.length-1].date+'</small></div>'}}history.innerHTML='<h3 style="margin-top:18px">Historial de medidas</h3>'+entries.slice().reverse().slice(0,6).map(x=>{const vals=Object.entries(labels).filter(([key])=>Number.isFinite(Number(x[key]))&&x[key]!==null).map(([key,label])=>label+': '+(typeof formatAppLength==='function'?formatAppLength(Number(x[key])):Number(x[key]).toFixed(1)+' cm')).join(' · ');return '<div class="weight-history-row"><div><strong>'+new Date(x.date+'T12:00:00').toLocaleDateString(getMPMFITLocale(),{day:'numeric',month:'short',year:'numeric'})+'</strong><div class="hint">'+vals+'</div></div><button class="btn ghost small" onclick="deleteBodyMeasurements(&quot;'+x.id+'&quot;)">Eliminar</button></div>'}).join('');
}
function saveBodyMeasurements(){
 const date=document.getElementById('bodyMeasureDate')?.value,fields={waist:'measureWaist',chest:'measureChest',arm:'measureArm',thigh:'measureThigh',bodyFat:'measureBodyFat'},values={};if(!date){toast('Selecciona una fecha');return}
 for(const [key,id] of Object.entries(fields)){const raw=document.getElementById(id)?.value;if(raw==='')continue;const inputValue=Number(String(raw).replace(',','.')),value=(key!=='bodyFat'&&typeof getMPMFITPreference==='function'&&getMPMFITPreference('length')==='in'?inputValue*2.54:inputValue);if(!Number.isFinite(value)||value<1||value>(key==='bodyFat'?70:300)){toast('Revisa las medidas: grasa corporal entre 1 y 70 % y perímetros entre 1 y 300 cm');return}values[key]=value}
 if(!Object.keys(values).length){toast('Introduce al menos una medida');return}
 const entries=getBodyMeasureEntries(),index=entries.findIndex(x=>x.date===date);if(index>=0){if(!confirm('Ya hay medidas guardadas para ese día. ¿Quieres sustituirlas?'))return;entries[index]={...entries[index],...values,date,id:entries[index].id}}else entries.push({...values,date,id:typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()});
 localStorage.setItem(bodyMeasureStorageKey(),JSON.stringify(entries));if(window.MPMFitCloudSync)window.MPMFitCloudSync.markDirty();Object.values(fields).forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});renderBodyMeasurements();toast('Medidas guardadas');
}
function deleteBodyMeasurements(id){const entries=getBodyMeasureEntries().filter(x=>x.id!==id);localStorage.setItem(bodyMeasureStorageKey(),JSON.stringify(entries));if(window.MPMFitCloudSync)window.MPMFitCloudSync.markDirty();renderBodyMeasurements();toast('Medición eliminada')}

// Objetivo de peso configurable por usuario.
function bodyWeightGoalKey(){return 'mpmfit_bodyweight_goal_v1_'+(currentUser?.id||'guest')}
function renderBodyWeightGoal(){
 syncProgressUnitInputs();
 const input=document.getElementById('bodyWeightGoal'),box=document.getElementById('bodyWeightGoalSummary');if(!input||!box)return;
 const raw=localStorage.getItem(bodyWeightGoalKey()),goal=raw===null?NaN:Number(raw),entries=getBodyWeightEntries().sort((a,b)=>a.date.localeCompare(b.date));
 if(Number.isFinite(goal)&&goal>=20&&goal<=400){const massUnit=typeof getMPMFITPreference==='function'?getMPMFITPreference('mass'):'kg',display=v=>(massUnit==='lb'?v*2.2046226218:v).toFixed(1);input.value=display(goal);if(entries.length){const current=Number(entries[entries.length-1].weight),remaining=goal-current;box.textContent='Último peso: '+display(current)+' '+massUnit+' · Objetivo: '+display(goal)+' '+massUnit+' · '+(Math.abs(remaining)<.05?'Objetivo alcanzado':(remaining>0?'Faltan ':'Diferencia: ')+display(Math.abs(remaining))+' '+massUnit)}else box.textContent='Objetivo guardado. Registra tu peso para ver cuánto falta.'}
 else{input.value='';box.textContent='Sin objetivo establecido.'}
}
function saveBodyWeightGoal(){
 const input=document.getElementById('bodyWeightGoal'),raw=input?.value;if(!raw){localStorage.removeItem(bodyWeightGoalKey());if(window.MPMFitCloudSync)window.MPMFitCloudSync.markDirty();renderBodyWeightGoal();toast('Objetivo eliminado');return}
 const value=Number(String(raw).replace(',','.'));const kgValue=typeof appMassToKg==='function'?appMassToKg(value):value;if(!Number.isFinite(kgValue)||kgValue<20||kgValue>400){toast('Introduce un objetivo entre 20 y 400 kg');return}
 localStorage.setItem(bodyWeightGoalKey(),String(kgValue));if(window.MPMFitCloudSync)window.MPMFitCloudSync.markDirty();renderBodyWeightGoal();toast('Objetivo de peso guardado');
}
// Fotos privadas: se guardan en IndexedDB de este navegador, no en la nube.
function progressPhotoDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open('mpmfit_progress_photos',1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('photos'))db.createObjectStore('photos',{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function getProgressPhotos(){const db=await progressPhotoDb();return new Promise((resolve,reject)=>{const req=db.transaction('photos','readonly').objectStore('photos').getAll();req.onsuccess=()=>resolve(req.result.filter(x=>x.owner===(currentUser?.id||'guest')).sort((a,b)=>b.date.localeCompare(a.date)));req.onerror=()=>reject(req.error)})}
async function saveProgressPhoto(){
 const fileInput=document.getElementById('progressPhotoFile'),date=document.getElementById('progressPhotoDate')?.value,file=fileInput?.files?.[0];if(!file||!date){toast('Selecciona una fecha y una imagen');return}if(!file.type.startsWith('image/')){toast('El archivo debe ser una imagen');return}
 try{
  const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)});
  const scale=Math.min(1,1400/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/jpeg',.82),db=await progressPhotoDb(),record={id:typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),owner:currentUser?.id||'guest',date,data};
  await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  fileInput.value='';renderProgressPhotos();toast('Foto de progreso guardada');
 }catch(e){console.error(e);toast('No se ha podido guardar la imagen en este dispositivo')}
}
async function renderProgressPhotos(){
 const box=document.getElementById('progressPhotoGallery');if(!box)return;
 try{const photos=await getProgressPhotos();box.innerHTML=photos.length?photos.map(p=>'<div class="progress-photo-card"><img src="'+p.data+'" alt="Foto de progreso del '+p.date+'"><div class="row" style="justify-content:space-between;align-items:center;margin-top:8px"><small>'+new Date(p.date+'T12:00:00').toLocaleDateString(getMPMFITLocale(),{day:'numeric',month:'short',year:'numeric'})+'</small><button class="btn ghost small" onclick="deleteProgressPhoto(&quot;'+p.id+'&quot;)">Eliminar</button></div></div>').join(''):'<div class="empty">Todavía no has guardado fotos de progreso.</div>'}
 catch(e){box.innerHTML='<div class="empty">El navegador no permite guardar fotos de progreso en este dispositivo.</div>'}
}
async function deleteProgressPhoto(id){
 try{const db=await progressPhotoDb();await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite'),store=tx.objectStore('photos'),req=store.get(id);req.onsuccess=()=>{if(req.result?.owner===(currentUser?.id||'guest'))store.delete(id)};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});renderProgressPhotos();toast('Foto eliminada')}catch(e){toast('No se ha podido eliminar la foto')}
}
