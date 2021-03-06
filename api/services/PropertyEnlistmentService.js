'use strict';

const PropertyEnlistmentContractService = require('./PropertyEnlistmentContractService');
const Status = require('../models/enums/PropertyEnlistmentStatus');
const log = require('../../server/logger');
const _ = require("lodash");
async function mapAllContractEnlistments(dbEnlistmentInstances) {
  return Promise.all(dbEnlistmentInstances.map(async (instanceObj) => {
    let dbEnlistment = instanceObj.get({ plain: true });

    const contractEnlistment =
      await PropertyEnlistmentContractService.getEnlistment(dbEnlistment.contractAddress);
    return Object.assign({}, dbEnlistment, contractEnlistment);
  }));
}

module.exports = {
  createEnlistment(enlistment) {
    enlistment.geolocation = {
      type: 'Point',
      coordinates: [enlistment.latitude, enlistment.longitude]
    };
    enlistment.offerAuthors = [];
    console.log("enlll",enlistment.landlordName)
   // enlistment.photos = [];
   // enlistment.furniture = [];
   // enlistment.photos = JSON.parse(enlistment.photo);
   // console.log("eee",enlistment.photos);
   /* _.forEach(enlistment.photo, function(val,key) {
      enlistment.photos.push(val);
    })
    _.forEach(enlistment.furnitures, function(val1,key) {
      enlistment.furniture.push(val1);
    })*/
    
    //console.log("enlistment",enlistment.photos);
    return Models.PropertyEnlistment.create(enlistment);
  },

  async getEnlistment(id) {
    const dbEnlistment = (await Models.PropertyEnlistment.findById(id)).get({plain: true});
    let contractEnlistment;
    if (dbEnlistment.contractAddress && dbEnlistment.contractAddress.length > 0) {
      contractEnlistment = await PropertyEnlistmentContractService.getEnlistment(dbEnlistment.contractAddress);
    }
    return Object.assign({}, dbEnlistment, contractEnlistment);
  },

  findInArea(latitude, longitude, distance = 5000) {
    return Models.PropertyEnlistment.findInArea(latitude, longitude, distance);
  },

  findAllUnpublished() {
    return Models.PropertyEnlistment.findAll(
      {
        where: { status: [Status.REJECTED, Status.PENDING, Status.CANCELLED] }
      }
    );
  },

  async findAllReviewed() {
    const dbEnlistments = await Models.PropertyEnlistment.findAll(
      {
        attributes: {
          exclude: ['offerAuthors']
        },
        where: { status: Status.APPROVED }
      }
    );

    return mapAllContractEnlistments(dbEnlistments);
  },

  async findByLandlord(landlordEmail) {
    const dbEnlistments = await Models.PropertyEnlistment.findAll(
      {
        where: {
          landlordEmail: landlordEmail
        }
      }
    );
    return mapAllContractEnlistments(dbEnlistments);
  },

  async findWithOffersByBidder(bidderEmail) {
    const dbEnlistments = await Models.PropertyEnlistment.findAll(
      {
        where: {
          offerAuthors: {
            $contains: [bidderEmail]
          }
        }
      }
    );
    return mapAllContractEnlistments(dbEnlistments);
  },

  async   approveEnlistment(enlistmentId) {
    console.log("id",enlistmentId);
    const enlistment = await Models.PropertyEnlistment.findOne({ where: { id: enlistmentId } });
    console.log("approve",enlistment);
    enlistment.approve();
    console.log("heyy coming here");
    enlistment.contractAddress = await PropertyEnlistmentContractService.createEnlistment(
      enlistment.landlordEmail,
      enlistment.landlordName,
      enlistment.streetName,
      enlistment.floor,
      enlistment.apartment,
      enlistment.house,
      enlistment.zipCode
    );

    return enlistment.save();
  },

  async rejectEnlistment(enlistmentId) {
    console.log("iddd",enlistmentId);
    const enlistment = await Models.PropertyEnlistment.findOne({ where: { id: enlistmentId } });
console.log("enlistment",enlistment);
    enlistment.reject();

    return enlistment.save();
  },

  async sendOffer(enlistmentId, { amount, tenantName, tenantEmail }) {

    
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });
    console.log("enlistment",enlistment);
    console.log("contract",enlistment.contractAddress)
    await PropertyEnlistmentContractService.sendOffer(enlistment.contractAddress, { amount, tenantName, tenantEmail });
    await enlistment.addOfferAuthor(tenantEmail);
    return enlistment.save();
  },

  async getOffers(enlistmentId) {
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });
    return Promise.all(enlistment.get({plain: true}).offerAuthors.map(async (offerAuthor) => {
      const contractOffer =
        await PropertyEnlistmentContractService.getOffer(enlistment.contractAddress, offerAuthor);
      return contractOffer;
    }));
  },

  async getOffer(enlistmentId, tenantEmail) {
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });

    const contractOffer = await PropertyEnlistmentContractService.getOffer(enlistment.contractAddress, tenantEmail);
    if (!contractOffer.initialized) {
      throw new Error(404);
    }
    return contractOffer;
  },

  async cancelOffer(enlistmentId, tenantEmail) {
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });

    return PropertyEnlistmentContractService.cancelOffer(enlistment.contractAddress, tenantEmail);
  },

  async reviewOffer(enlistmentId, tenantEmail, approved = true) {
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });

    return PropertyEnlistmentContractService.reviewOffer(enlistment.contractAddress, tenantEmail, approved);
  },

  async submitAgreementDraft(enlistmentId, tenantEmail, agreementDraft) {

    console.log("enlistment id",enlistmentId);
    console.log("enlistment id",tenantEmail);
    console.log("enlistment id",agreementDraft);
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });
    console.log("found enlist,ment",enlistment);
    return PropertyEnlistmentContractService.submitAgreementDraft(enlistment.contractAddress, tenantEmail, agreementDraft);
  },

  async getAgreement(enlistmentId, tenantEmail) {
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });

    return PropertyEnlistmentContractService.getAgreement(enlistment.contractAddress, tenantEmail);
  },

  async reviewAgreement(enlistmentId, tenantEmail, confirmed = true) {
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });

    return PropertyEnlistmentContractService.reviewAgreement(enlistment.contractAddress, tenantEmail, confirmed);
  },

  async signAgreement(enlistmentId, tenantEmail, party, signature) {
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });

    if (party === 'landlord') {
      return PropertyEnlistmentContractService.landlordSignAgreement(enlistment.contractAddress, tenantEmail, signature);
    } else {
      return PropertyEnlistmentContractService.tenantSignAgreement(enlistment.contractAddress, tenantEmail, signature);
    }
  },

  async cancelAgreement(enlistmentId, tenantEmail) {
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });

    return PropertyEnlistmentContractService.cancelAgreement(enlistment.contractAddress, tenantEmail);
  },

  async receiveFirstMonthRent(enlistmentId, tenantEmail) {
    const enlistment = await Models.PropertyEnlistment.findOne({
      where: {
        id: enlistmentId
      }
    });

    return PropertyEnlistmentContractService.receiveFirstMonthRent(enlistment.contractAddress, tenantEmail);
  }
};
