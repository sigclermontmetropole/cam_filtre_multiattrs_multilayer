/** @jsx jsx */
/** @jsxFrag React.Fragment */
import { AllWidgetProps, css, jsx, React, QueryResult, SqlQueryParams } from 'jimu-core'
import {FeatureLayerDataSource, DataSourceManager, DataSourceComponent, MultipleDataSourceComponent , FeatureLayerQueryParams} from 'jimu-core'
import { useEffect, useRef, useState } from 'react'
import { IMConfig } from '../config'
import { JimuMapView, JimuMapViewComponent} from 'jimu-arcgis'
import { Label, Switch, ButtonGroup, MultiSelect, TextInput, MultiSelectItem } from 'jimu-ui'
import { isNull } from 'lodash-es'
import { string } from 'prop-types'

const txt_nofilter = "Pas de filtre"
const txt_items = "éléments"

var settings_ds = []
var settings_filter_ccb_array = []
const type_ccb = "checkcombobox"
const nb_max_val_attr = 50
const index_ccb_attribute_name = 0
const index_ccb_attribute_alias = 1
const index_ccb_attribute_values_tab = 2
const index_ccb_attribute_filter = 3
const index_ccb_attribute_values_valide = 4

var settings_filter_periode_array = []
const type_periode = "periode"
const index_periode_label = 0
const index_periode_actif = 1
const index_periode_label_date_1 = 2
const index_periode_label_date_2 = 3
const index_periode_date_1 = 4
const index_periode_date_2 = 5
const index_periode_attrs = 6

const display_debug_console_initialisation = false
const display_debug_console_application_filtre = false
const display_debug_console_action_ccb = false
const display_debug_console_action_periode = false

const css_barre_filtre = css``
// Pour css_ccb si besoin : jimu-dropdown-item-checkbox {display: block !important;opacity: 1 !important;
const css_ccb = css`margin-top:3px;margin-left:2px;margin-right:2px;};`
const css_switch = css`margin-top:8px;margin-right:10px;`
const css_label = css`margin-top:7px;margin-right:8px;margin-left:15px;white-space:nowrap;`
const css_date = css`margin-top:2px;margin-bottom:2px;margin-right:5px;border:none;`
const css_periode = css`margin-left:2px;margin-right:2px;padding-right:10px;background-color:white;border: 1px solid rgb(197, 197, 197)`
const today_moins = new Date()
const today_plus = new Date()
const min_date = new Date('2022-01-01T01:00:00');
const max_date = new Date('2030-12-31T23:00:00');
today_moins.setMonth(today_moins.getMonth() - 3)
today_plus.setMonth(today_plus.getMonth() + 3)

function compare( a, b ) {
  if ( a.value < b.value ){
    return -1;
  }
  if ( a.value > b.value ){
    return 1;
  }
  return 0;
}

// export default function Widget (props: AllWidgetProps<IMConfig> ) {
const Widget = (props: AllWidgetProps<IMConfig>) => {
  const [data, setData] = useState<string>("")
  const [jmv, setJmv] = useState<JimuMapView>(null)
  const [DScharge, setDScharge] = useState<number>(-1)
  // const [status, setStatus] = useState<boolean>(false);
  const onActiveViewChange = (jmv: JimuMapView) => {if (!isNull(jmv)) setJmv(jmv);}

  
  for (var j=0; j<props.useDataSources.length; j++) {
    settings_ds.push([props.useDataSources[j], undefined, false])
  }
  // ------------------------------------------------------------------------------------------------------------
  // ---------------------------------------- INITIALISATION ----------------------------------------------------
  // ------------------------------------------------------------------------------------------------------------
  useEffect(() => {
    if ( ! isNull(jmv) ) {
      // Ne fonctionne pas (version exb ?)
      var popup : __esri.Popup = jmv.view.popup
      popup.dockEnabled = true
      jmv.view.popup = popup
    }
    else
    {
      // Initialisation de configurations pour les attributs
      if (display_debug_console_initialisation) console.log("JMV non initialisé : préparation de la configuration de base")
      initialisationFiltres() 
    }  
  }, [jmv])

  useEffect(() => {
    if (DScharge >= 0) {
      alimenteComboBox(DScharge) 
    }
  }, [DScharge])

  const alimenteComboBox = (index_ds) => {
    const promises: Array<Promise<QueryResult>> = [];
    // --------------------------------------------------------------------------------
    if (display_debug_console_initialisation) console.log("DS initialisés : on a notre DS donc on peut remplir les CCB")
    if (display_debug_console_initialisation) console.log("Traitement des ccb pour récupérer les valeurs")
    for (var i=0; i<settings_filter_ccb_array.length; i++) {
      settings_filter_ccb_array[i][index_ccb_attribute_values_tab]=[];
      var attr = settings_filter_ccb_array[i][index_ccb_attribute_name]
      if (display_debug_console_initialisation) console.log("Préparation promise : " + attr)
      var configuredQueryParams: FeatureLayerQueryParams = {
        where: '1 = 1',
        orderByFields: [attr],
        outFields: [attr],
        returnGeometry: false,
        geometry: null,
        time:1000,
        returnDistinctValues: true
      };      
      // if (display_debug_console_initialisation) console.log("DataSourceManager")   
      // if (display_debug_console_initialisation) console.log(DataSourceManager.getInstance())   
      for (var j=0; j<props.useDataSources.length; j++) {
         var ds = DataSourceManager.getInstance().getDataSource(props.useDataSources[j].dataSourceId) as FeatureLayerDataSource;
        //var ds = DataSourceManager.getInstance().getDataSource(props.useDataSources[index_ds].dataSourceId) as FeatureLayerDataSource;
        if (ds != undefined) {
          if (display_debug_console_initialisation) console.log("  Ajout promise")
          var p1 = ds.query(configuredQueryParams)
          p1.catch((error) => {
            if (display_debug_console_initialisation)console.log("  Erreur à la récupération du DS : ")
            if (display_debug_console_initialisation)console.log(ds)
            alert ("Erreur à la récupération d'une couche. Merci d'appuyer sur F5 pour recharger l'application")
            return error;
          })
          promises.push(p1);
          // promises.push(ds.query(configuredQueryParams));
        }
      }
    }  

    // Envois et traitement retour des premises
    Promise.all(promises).then((data) => {
      data.forEach((d) => {
        if (d.records.length === 0) return;
        var attrQP:FeatureLayerQueryParams = d.queryParams
        var attr = attrQP.outFields[0]
        if (display_debug_console_initialisation) console.log("Retour promise : " + attr)
        var btrouve = false
        var index = -1
        // Il faut retrouver l'attribut concerné dans le tableau de configuration (pas trouvé comment donner son index à la demande de la promise)
        for (var i=0; i<settings_filter_ccb_array.length; i++) {
          if (settings_filter_ccb_array[i][index_ccb_attribute_name] == attr) {
            btrouve = true
            index = i
          }
        }
        // Attribut retrouvé. On injecte les valeurs d'attributs
        if (btrouve) {
          
          d.records.forEach((info) => { 
            var item={label: info.getFieldValue(attr), value: info.getFieldValue(attr)}
            var itemTest={key: info.getFieldValue(attr), ref: null, props:{label: info.getFieldValue(attr), value: info.getFieldValue(attr)}}
            // if (inArray(item, settings_filter_ccb_array[index]) == false)

            if (! settings_filter_ccb_array[index][index_ccb_attribute_values_tab].some(obj => obj.value === info.getFieldValue(attr)))
            {
              settings_filter_ccb_array[index][index_ccb_attribute_values_tab].push(item);
            }
            settings_filter_ccb_array[index][index_ccb_attribute_values_valide] = true
            if (display_debug_console_initialisation) console.log("  " + attr + " : " +  info.getFieldValue(attr))
          })      
          settings_filter_ccb_array[index][index_ccb_attribute_values_tab].sort(compare);     
        }
      })
      // On change la valeur du data pour forcer le refresh
      setData("Initialisation : Fin récup promises");
    });
  }

  const initialisationFiltres = () => {
    for (var i=0; i<props.config.dataFilters.length; i++) {
      if (display_debug_console_initialisation) console.log("Attribut à traiter : ")
      if (display_debug_console_initialisation) console.log("  " + props.config.dataFilters[i])
      var infos_att = props.config.dataFilters[i].split(";")
      var type =  infos_att[0]
      // Cas d'une checkComboBox
      if (type == type_ccb)
      {
        initialiseComboBox(infos_att)
      }
      if (type == type_periode)
      {        
        initialisePeriode(infos_att)
      }
    }    
  }
  const initialiseComboBox =(infos_att) => {
    if (display_debug_console_initialisation) console.log("  -> Ajout en CCB")          
    var att = infos_att[1]
    var alias = infos_att[2]
    var items = []
    var itemssel = []
    var filtre = ""
    // On initilialise un tableau assez grand car la CCB n'arrive pas à agrandir sa taille une fois initialisée (réduire c'est bon)
    for (var j=0; j<nb_max_val_attr; j++) {
      items.push({label: "Alias" + j, value: "Value"  + alias + "|" + j})
    }        
    // Attention à l'ordre d'ajout si on change les index au début
    settings_filter_ccb_array.push([att, alias, items, filtre, false]) 
  }

  const initialisePeriode =(infos_att) => {
    if (display_debug_console_initialisation) console.log("  -> Ajout en periode")        
    var label = infos_att[1]
    var lavel_date1 = infos_att[2]
    var label_date2 = infos_att[3]
    var attrs=[]
    for (var j=4; j<infos_att.length; j++) {
      attrs.push(infos_att[j])
    } 
    // Gestion de la date par défaut
    settings_filter_periode_array.push([label, false, lavel_date1, label_date2, getDateFormatYYYYMMDD(today_moins, "-"), getDateFormatYYYYMMDD(today_plus, "-"), attrs])
  }    
  // ------------------------------------------------------------------------------------------------------------
  // ---------------------------------------- APPLICATION DU FILTRE ---------------------------------------------
  // ------------------------------------------------------------------------------------------------------------
  const getDateFormatYYYYMMDD = (d:Date, separateur:string="") => {
    var yyyy:string = d.getFullYear().toString()
    var mm:string = (d.getMonth() + 1).toString()
    var dd:string = d.getDate().toString()
    if (mm.length == 1) mm = "0" + mm
    if (dd.length == 1) dd = "0" + dd
    return (yyyy + separateur + mm + separateur + dd)
  }

  const appliquerFiltres = () => {
    if (display_debug_console_application_filtre) console.log(">> appliquerFiltres")
    // Le filtre final
    var filtre = ""

    // Gestion des ccb
    if (display_debug_console_application_filtre) console.log("Traitement Filtre CCB")
    if (display_debug_console_application_filtre) console.log(settings_filter_ccb_array)
    for (var i=0; i<settings_filter_ccb_array.length; i++) {
      if (! settings_filter_ccb_array[i][index_ccb_attribute_values_valide]) continue
      // Boucle sur les attributs pour récupérer le filtre existant
      // Le filtre est monté directement aux sélections dans la ccb car on récupère directement la liste des éléments sélectionnés de la ccb
      var filtre_attribut = settings_filter_ccb_array[i][index_ccb_attribute_filter]
      if (filtre_attribut != "") {
        if (filtre != "") {filtre += " AND "}
        filtre += "(" + filtre_attribut + ")"
        if (display_debug_console_application_filtre) console.log("  Filtre CCB : " + filtre_attribut)
      }
    }

    if (display_debug_console_application_filtre) console.log("Traitement Filtre periode")
    if (display_debug_console_application_filtre) console.log(settings_filter_periode_array)
    // Gestion des périodes
    for (var i=0; i<settings_filter_periode_array.length; i++) {
      // Si la période est indiqué active (à appliquer), on traite
      if (settings_filter_periode_array[i][index_periode_actif]){
        // Transformation des valeurs Date() en date utilisable par un timestamp
        var str_date1 = settings_filter_periode_array[i][index_periode_date_1]
        var str_date2 = settings_filter_periode_array[i][index_periode_date_2]
        // Boucle sur les attributs dates qui doivent être dans l'intervalle (en OR)
        filtre_attribut = ""
        for (var j=0; j<settings_filter_periode_array[i][index_periode_attrs].length;j++) {
          var attr = settings_filter_periode_array[i][index_periode_attrs][j]
          if (filtre_attribut != "") {filtre_attribut += " OR "}
          filtre_attribut += "(" + attr + " > timestamp '" + str_date1 + "' AND " + attr + " < timestamp '" + str_date2 + "')"
        }
        // Cas particulier
        // Si on a 2 atttributs, on considère que le 1er doit être avant la date min et le 2nd doit être après la date de fin
        // -> permet que les 2 dates englobent complètement l'intervalle sélectionné par l'utilisateur
        if (settings_filter_periode_array[i][index_periode_attrs].length == 2) {
          filtre_attribut += " OR (" + settings_filter_periode_array[i][index_periode_attrs][0] + " < timestamp '" + str_date1 + "' AND " + settings_filter_periode_array[i][index_periode_attrs][1] + " > timestamp '" + str_date2 + "')"
        }

        // Ajout au filtre global
        if (filtre != "") {filtre += " AND "}
        filtre += "(" + filtre_attribut + ")"
        if (display_debug_console_application_filtre) console.log("  Filtre Période : " + filtre_attribut)
      }
    }

    // Filtre global terminé
    if (display_debug_console_application_filtre) console.log("Filtre final : ")
    if (display_debug_console_application_filtre) console.log(filtre)
    
    // Boucle sur les datasources pour appliquer le filtre
    if (display_debug_console_application_filtre) console.log("Application du filtre sur les DS")
    for (var i=0; i<props.useDataSources.length; i++) {
      // filtre
      var query: SqlQueryParams = {
        where: filtre
      };
      // Application de la query au FeatureLayerDataSource
      var ds = DataSourceManager.getInstance().getDataSource(props.useDataSources[i].dataSourceId) as FeatureLayerDataSource;
      if (ds != undefined) {
        ds.updateQueryParams( query, props.id)
      }
    }
    // Fin de l'application des filtres
    if (display_debug_console_application_filtre) console.log("<< appliquerFiltres")
  }

  // ------------------------------------------------------------------------------------------------------------
  // --------------------------------------- GESTION DES CCB ----------------------------------------------------
  // ------------------------------------------------------------------------------------------------------------
const affichageCCB = (item, index) => {
  if (display_debug_console_action_ccb) console.log("Rendu CCB de l'index " + index + "  : " + item[index_ccb_attribute_alias])  
  if (!item[index_ccb_attribute_values_valide]) return;
 
  return (
    <MultiSelect
      css={css_ccb}
      placeholder={item[index_ccb_attribute_alias] + " : " + txt_nofilter}
      onChange={(modifVal, selectedValues) => handleItemClickCCB(selectedValues, index)}
      displayByValues={items => affichageItemCCB(items, index)}
    >
      {item[index_ccb_attribute_values_tab].map((opt) => (
        <MultiSelectItem
          label={opt.value}
          value={opt.value}
        />        
      ))}
    </MultiSelect>
  );
};

const handleItemClickCCB = (selectedValues, index) => {
  if (display_debug_console_action_ccb) {console.log("Clic dans CB")}
  var filtre = "";
  var attribut = settings_filter_ccb_array[index][index_ccb_attribute_name];
  var item = settings_filter_ccb_array[index];

  if (selectedValues.length > 0 && selectedValues.length != item[index_ccb_attribute_values_tab].length) {
    for (var j = 0; j < selectedValues.length; j++) {
      if (j > 0) { filtre += " OR " }
      var value = selectedValues[j].replace("'", "''");
      filtre += attribut + " = '" + value + "'";
    }
  }
  settings_filter_ccb_array[index][index_ccb_attribute_filter] = filtre;

  if (display_debug_console_action_ccb) {
    console.log("Modification d'un filtre dans une ccb. Liste des filtres CCB Existants");
    for (var i = 0; i < settings_filter_ccb_array.length; i++) {
      console.log("  -> " + settings_filter_ccb_array[i][index_ccb_attribute_name] + " : " + settings_filter_ccb_array[i][index_ccb_attribute_filter]);
    }
  }
  appliquerFiltres();
};

  // Configuration de l'affichage de l'entête des ccb
  const affichageItemCCB = (items, index) => {
    if (items.length == 1)
    {
      return (settings_filter_ccb_array[index][index_ccb_attribute_alias] + " : " + items[0])
    }
    else
    {
      return (settings_filter_ccb_array[index][index_ccb_attribute_alias] + " : " + items.length + " " + txt_items)
    }
  }

  // ------------------------------------------------------------------------------------------------------------
  // --------------------------------------- GESTION DES PERIODES -----------------------------------------------
  // ------------------------------------------------------------------------------------------------------------

  // Rendu du composant période
  const affichagePeriode = (item, index) => {
    // if (DS_Ref == null) return (<Label  css={css_label}>Erreur d'initialisation<br/>Pressez la toucheF5</Label>)
    if (display_debug_console_action_periode) console.log("Rendu période de l'index " + index + "  : " + item[index_periode_label])
    return (
      <div>
        <ButtonGroup size="default" vertical={false} css={css_periode}>
          <Label  css={css_label}>{item[index_periode_label]}</Label>         
          <Switch 
            css={css_switch}
            aria-label={item[index_periode_label]}
            checked={item[index_periode_actif]}  
            onChange={(evt,etat) => {handleCheckPeriode_change(evt, etat, index)}}
          />   
          <Label  css={css_label}>{item[index_periode_label_date_1]}</Label>
          <TextInput
            css={css_date}
            type="date"
            value={settings_filter_periode_array[index][index_periode_date_1]}
            checkValidityOnChange={value => handleDatePeriode_change(value, index, index_periode_date_1)}
          />            
          <Label  css={css_label}>{item[index_periode_label_date_2]}</Label>
          <TextInput
            css={css_date}
            type="date"
            value={settings_filter_periode_array[index][index_periode_date_2]}
            checkValidityOnChange={value => handleDatePeriode_change(value, index, index_periode_date_2)}
          />    
        </ButtonGroup>      
      </div>
    )
  }  
  // Modification de la date dans le calendrier
  const handleDatePeriode_change = (value, index, index_date)=> {
    // madate = value
    if (display_debug_console_action_periode) console.log("Changement de la date sélectionnée pour : " + value)
    if (value == "")
    {
      return {valid: false, msg: "Vous devez définir une date valide"}
    }
    settings_filter_periode_array[index][index_date] = value
    setData("date_" + index + "_" + value);
    // Application des filtres
    if (settings_filter_periode_array[index][index_periode_actif]) appliquerFiltres()        
    return {valid: true, msg: value}
  }

  // Modification du switch permettant d'activer le filtre
  const handleCheckPeriode_change= (evt,etat, index) => {
    if (display_debug_console_action_periode) console.log("Activation du filtre de " + settings_filter_periode_array[index][index_periode_label] + " : " + etat)
    settings_filter_periode_array[index][index_periode_actif] = etat
    // On change la valeur du data pour forcer le refresh visuel
    setData("check_" + index + "_" + etat);
    // Application des filtres
    appliquerFiltres()    
  }  
 
  const dsc=(item, index) => {
    return (
      <div>
        <DataSourceComponent widgetId={props.id} useDataSource={item} onDataSourceCreated={(ds) => setDScharge(index)}></DataSourceComponent>
      </div>
    )
  }  

  return (  
    <div css={css_barre_filtre}> 
    <ButtonGroup
      size="default"
      vertical={props.config.vertical}
    >
      {
        settings_filter_ccb_array.map( (item, index) =>  ( 
          affichageCCB(item, index)
        ))
      }
      {
        settings_filter_periode_array.map( (item, index) =>  ( 
          affichagePeriode(item, index)
        ))
      }
    </ButtonGroup>
  <></>

      {props
        .useMapWidgetIds && <JimuMapViewComponent useMapWidgetId={props.useMapWidgetIds[0]} onActiveViewChange = {onActiveViewChange}/>
      }  
      {
        props.useDataSources.map( (item, index) =>  ( 
          dsc(item, index)
        ))
      }
    </div>
  )
}


export default Widget