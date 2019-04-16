import React from 'react';
import constants from "../constants"
import {
  updateBlock, updateRate, updateAllRate, updateAllRateUSD,
  checkConnection, setGasPrice, setMaxGasPrice
} from "../../actions/globalActions"
import { updateAccount, updateTokenBalance } from "../../actions/accountActions"
import { updateTx, updateApproveTxsData } from "../../actions/txActions"
import { updateRateExchange, estimateGas, checkKyberEnable, verifyExchange } from "../../actions/exchangeActions"
import { estimateGasTransfer, verifyTransfer } from "../../actions/transferActions"
import * as marketActions from "../../actions/marketActions"
import BLOCKCHAIN_INFO from "../../../../env"
import { store } from "../../store"
import * as converter from "../../utils/converter"
import * as providers from "./nodeProviders"
import * as common from "../../utils/common"

export default class EthereumService extends React.Component {
  constructor(props) {
    super(props)

    console.log("network_name")
    console.log(props.network)
    
    this.network = props.network

    this.listProviders = []
    for (var node of BLOCKCHAIN_INFO[this.network].connections.http) {
      switch (node.type) {
        case "cached":
          var provider = new providers.CachedServerProvider({ url: node.endPoint, network: this.network })
          this.listProviders.push(provider)
          break
        case "prune":
          var provider = new providers.PruneProvider({ url: node.endPoint, network: this.network })
          this.listProviders.push(provider)
          break
        case "none_prune":
          var provider = new providers.NonePruneProvider({ url: node.endPoint, network: this.network })
          this.listProviders.push(provider)
          break
      }
    }
  }

  subcribe() {
    console.log("subcribe")
    var callBackAsync = this.fetchData.bind(this)
    callBackAsync()
    this.intervalAsyncID = setInterval(callBackAsync, 10000)
  }

  clearSubcription() {
    clearInterval(this.intervalID)
    clearInterval(this.intervalSyncID)
  }

  fetchData() {
    var state = store.getState()
    if (!common.checkComponentExist(state.global.params.appId)){
      this.clearSubcription()
      return
    }
    this.checkKyberEnable()
    this.fetchRateData()
    this.fetchRateUSD()
    this.fetchAccountData()
    this.fetchRateExchange()
    this.checkConnection()
    this.fetchMaxGasPrice()
    this.fetchGasprice()
  }


  fetchData5Min(){
    this.fetchVolumn()
  }

  fetchDataSync() {
    var state = store.getState()
    this.verifyExchange()    
  }

  testAnalize() {
    var state = store.getState()
    var ethereum = state.connection.ethereum
  }
  
  fetchVolumn () {
    store.dispatch(marketActions.getVolumn())
  }
  
  fetchRateData() {
    var state = store.getState()
    var tokens = state.tokens.tokens
    var ethereum = state.connection.ethereum  
    store.dispatch(updateAllRate(ethereum, tokens))
  }

  fetchTokenBalance() {
    var state = store.getState()
    var ethereum = state.connection.ethereum
    var tokens = state.tokens.tokens
    var account = state.account.account
    if (account.address) {
      store.dispatch(updateTokenBalance(ethereum, account.address, tokens))
    }
  }

  fetchRateUSD() {
    var state = store.getState()
    var ethereum = state.connection.ethereum
    var tokens = state.tokens.tokens
    
    store.dispatch(updateAllRateUSD(ethereum, tokens))
  }

  fetchTxsData = () => {
    var state = store.getState()
    var tx
    var txs = state.txs
    var ethereum = state.connection.ethereum

    var account = state.account.account
    var listToken = {}
    Object.keys(txs).forEach((hash) => {
      tx = txs[hash]
      if (tx.status == "pending") {
        if (tx.type === "exchange") {
          var exchange = state.exchange
          listToken = {
            source: {
              symbol: exchange.sourceTokenSymbol,
              address: exchange.sourceToken
            },
            dest: {
              symbol: exchange.destTokenSymbol,
              address: exchange.destToken
            }
          }
          store.dispatch(updateTx(ethereum, tx, account, listToken))
        } else {
          var transfer = state.transfer
          listToken = {
            token: {
              symbol: transfer.tokenSymbol,
              address: transfer.token
            }
          }
          store.dispatch(updateTx(ethereum, tx, account, listToken))
        }

      }
    })
  }


  fetchApproveTxsData = () =>{
    store.dispatch(updateApproveTxsData())
  }

  fetchAccountData = () => {
    var state = store.getState()
    var ethereum = state.connection.ethereum
    var account = state.account.account
    if (account.address) {
      store.dispatch(updateAccount(ethereum, account))
    }
  }

  fetchCurrentBlock = () => {
    var state = store.getState()
    var ethereum = state.connection.ethereum
    store.dispatch(updateBlock(ethereum))
  }

  fetchRateExchange = (isManual = false) => {
    var state = store.getState()
    var exchange = state.exchange
    var tokens = state.tokens.tokens
    var tokens = state.tokens.tokens

    if (exchange.sourceTokenSymbol === exchange.destTokenSymbol){
      return
    }

    var source = exchange.sourceToken
    var dest = exchange.destToken
    var sourceAmount

    if (exchange.isHaveDestAmount){
      //get rate source by eth
      var rateSource = Math.pow(10,18)     
      if (exchange.sourceTokenSymbol !== "ETH"){
        rateSource = tokens[exchange.sourceTokenSymbol].rate
      }
      var rateDest = Math.pow(10,18)     
      if (exchange.destTokenSymbol !== "ETH"){
        rateDest = tokens[exchange.destTokenSymbol].rateEth
      }
      var rate = rateSource * rateDest / Math.pow(10,18)      
      sourceAmount = converter.caculateSourceAmount(exchange.destAmount, rate.toString(), 6)
    }else{
      sourceAmount = exchange.sourceAmount
    }

    var sourceTokenSymbol = exchange.sourceTokenSymbol

    store.dispatch(updateRateExchange(source, dest, sourceAmount, sourceTokenSymbol, isManual))
  }

  fetchGasprice = () => {
    var state = store.getState()
    var ethereum = state.connection.ethereum
    store.dispatch(setGasPrice(ethereum))
  }

  fetchMaxGasPrice = () => {
    var state = store.getState()
    store.dispatch(setMaxGasPrice())
  }

  fetchGasExchange = () => {
    var state = store.getState()
    var account = state.account.account
    if (!account.address) {
      return
    }
    var pathname = state.router.location.pathname
    console.log(pathname)
    if (!pathname.includes(constants.BASE_HOST + "/swap")) {
      return
    }
    store.dispatch(estimateGas())
  }

  fetchGasTransfer = () => {
    var state = store.getState()
    var account = state.account.account
    if (!account.address) {
      return
    }

    var pathname = state.router.location.pathname
    if (!pathname.includes(constants.BASE_HOST + "/transfer")) {
      return
    }
    store.dispatch(estimateGasTransfer())
  }

  fetMarketData = () => {
    store.dispatch(marketActions.getMarketData())
  }

  fetGeneralInfoTokens() {
    store.dispatch(marketActions.getGeneralInfoTokens())
  }

  verifyExchange = () => {
    var state = store.getState()
    
    var exchange = state.exchange
    if (exchange.step !== 1){
      return
    }

    store.dispatch(verifyExchange())
  }

  verifyTransfer = () => {
    var state = store.getState()
    var account = state.account.account
    if (!account.address) {
      return
    }

    var pathname = state.router.location.pathname
    if (!pathname.includes(constants.BASE_HOST + "/transfer")) {
      return
    }
    store.dispatch(verifyTransfer())
  }

  checkConnection = () => {
    var state = store.getState()
    var checker = state.global.conn_checker
    var ethereum = state.connection.ethereum
    store.dispatch(checkConnection(ethereum, checker.count, checker.maxCount, checker.isCheck))
  }

  checkKyberEnable = () => {
    store.dispatch(checkKyberEnable())
  }

  promiseOneNode(list, index, fn, callBackSuccess, callBackFail, ...args) {
    if (!list[index]) {
      callBackFail(new Error("Cannot resolve result: " + fn))
      return
    }
    if (!list[index][fn]) {
      console.log("Not have " + fn + " in " + list[index].rpcUrl)
      this.promiseOneNode(list, ++index, fn, callBackSuccess, callBackFail, ...args)
      return
    }
    list[index][fn](...args).then(result => {
      console.log("Resolve " + fn + "successful in " + list[index].rpcUrl)
      callBackSuccess(result)
    }).catch(err => {
      console.log(err.message + " -In provider: " + list[index].rpcUrl)
      this.promiseOneNode(list, ++index, fn, callBackSuccess, callBackFail, ...args)
    })
  }

  call(fn, ...args) {
    return new Promise((resolve, reject) => {
      this.promiseOneNode(this.listProviders, 0, fn, resolve, reject, ...args)
    })
  }


  promiseMultiNode(list, index, fn, callBackSuccess, callBackFail, results, errors, ...args) {
    if (!list[index]) {
      if(results.length > 0){
       // callBackSuccess(results[0])
       console.log("resolve "+fn+" successfully in some nodes")
      }else{
        callBackFail(errors)
      }      
      return
    }
    if (!list[index][fn]) {
      console.log(list[index].rpcUrl +  " not support func: " + fn)
      errors.push(new Error(list[index].rpcUrl +  " not support func: " + fn))
      this.promiseMultiNode(list, ++index, fn, callBackSuccess, callBackFail, results, errors, ...args)
      return
    }
    list[index][fn](...args).then(result => {      
      console.log("Call " + fn + " successfully in " + list[index].rpcUrl)
      results.push(result)
      this.promiseMultiNode(list, ++index, fn, callBackSuccess, callBackFail, results, errors, ...args)
      callBackSuccess(result)
    }).catch(err => {
      console.log(err.message + " -In provider: " + list[index].rpcUrl)
      errors.push(err)
      this.promiseMultiNode(list, ++index, fn, callBackSuccess, callBackFail, results, errors, ...args)
    })
  }

  callMultiNode(fn, ...args) {
    var errors = []
    var results = []
    return new Promise((resolve, reject) => {
      this.promiseMultiNode(this.listProviders, 0, fn, resolve, reject, results, errors, ...args)
    })
  }

}
