/*
 * Mongoose'da neden modele ihitiyaç duyarız ?
 * Bir kolleksiyona yeni bir veri eklerken bunun bir kısıtlmaya tabi tutulmasını isteriz önreğin users kolleksiyonundaki her bir nesnenin name,surname ve age değerlnin olmaını iseriz. Kyadeidlecek olan her bir veri bu şemadaki kısıtlamlara uygunsa kaydedilir aksi takdirde hata fırlatır.
 * Bu sayede kolleksiyonda tutulan dökümanalrın daha tutarlı olmasını sağlarız
 */

const mongoose = require("mongoose");
const validator = require("validator");
// veritabanına kaydedilecek olan verilerin kısıtlamalarını yazarız
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: [true, "Bu tur ismi zaten mevcut"],
      required: [true, "Tur isim değerine sahip olmalı"],
      // validate: [
      //   validator.isAlphanumeric, // third party validator
      //   "Tur ismi özel karakter içermemeli",
      // ],
    },

    price: {
      type: Number,
      required: [true, "Tur fiyat değerine sahip olmalı"],
    },

    priceDiscount: {
      type: Number,
      // custom validator (kendi yazdığımız kontrol methdoları)
      // doğrulama fonksiyonları false return ederse doğrulamadna geçmedi anlmaına gelir ve belge veritabanına kaydedilmez true return ederse doğrulamadan geçti anlamına gelir
      validate: {
        validator: function (value) {
          return value < this.price;
        },
        message: "İndirim fiyatı asıl fiyattan büyük olamaz",
      },
    },

    duration: {
      type: Number,
      required: [true, "Tur süre değerine sahip olmalı"],
    },

    difficulty: {
      type: String,
      required: [true, "Tur zorluk değerine sahip olmalı"],
      enum: ["easy", "medium", "hard", "difficult"],
    },

    maxGroupSize: {
      type: Number,
      required: [
        true,
        "Tur maksimum kişi sayısı değerine sahip olmalı",
      ],
    },

    ratingsAverage: {
      type: Number,
      min: [1, "Rating değeri 1'den küçük olamaz"],
      max: [5, "Rating değeri 5'den büyük olamaz"],
      default: 4.0,
    },

    ratingsQuantity: {
      type: Number,
      default: 0,
    },

    summary: {
      type: String,
      maxLength: [200, "Özet alanı 200 karakteri geçemez"],
      required: [true, "Tur özet değerine sahip olmalı"],
    },

    description: {
      type: String,
      maxLength: [1000, "Açıklama alanı 1000 karakteri geçemez"],
      required: [true, "Tur açıklama değerine sahip olmalı"],
    },

    imageCover: {
      type: String,
      required: [true, "Tur kağak fotğrafına sahip olmalı"],
    },

    images: {
      type: [String],
    },

    startDates: {
      type: [Date],
    },

    durationHour: { type: Number },

    // embedding
    startLocation: {
      description: String,
      type: { type: String, default: "Point", enum: "Point" },
      coordinates: [Number],
      address: String,
    },

    // embedding
    locations: [
      {
        description: String,
        type: { type: String, default: "Point", enum: "Point" },
        coordinates: [Number],
        day: Number,
      },
    ],

    // refferance
    guides: [
      {
        type: mongoose.Schema.ObjectId, // referans tanımında tip her zaman Object Id'di
        ref: "User", // id'lerin hangi kolleksiyona ait olduğunu söyledik
      },
    ],
  },
  // şema ayarları
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//! Virtual Populate
tourSchema.virtual("reviews", {
  ref: "Review",
  localField: "_id", // review dökümanınındaki "tour" alanının tour dökümandaki karşılığı olan alan
  foreignField: "tour", // tour dökümandaki "_id" alanının yorum dökümanındaki karşılığı
});

//! Virtual Property
// Örn: Şuan veritbanında turların fiyatlarını ve indirim fiyatını tutuyoruz ama frontend bizden ayrıca indirimli fiyarıda istedi. Bu noktada indirimli fiyatı veritabanında tutmak gereksiz maaliyet olur. Bunun yerine cevap gönderme sırasında bu değeri hesaplyıp eklersek hem frontend'in ihtiyacını karşılamış oluruz hemde veritbanıdna gereksiz yer kaplamaz
tourSchema.virtual("discountedPrice").get(function () {
  return this.price - this.priceDiscount;
});

// Örn: Şuan veritabanında tur ismini tutuyoruz ama client ekstra olarak slug istedi.
// The City Wanderer: the-city-wanderer
tourSchema.virtual("slug").get(function () {
  return this.name.replaceAll(" ", "-").toLowerCase();
});

//! Document Middleware
// Bir belgenin kaydedilme, güncelleme, silinme, okunma gibi  olaylarından önce veya sonra işlem gerçekleştirmek istiyorsak kullanırız.
// Örn: Client'tan gelen tur verisinin veritbanına kaydilmeden önce kaç saat sürdüğünü hesplayalım.
tourSchema.pre("save", function (next) {
  // gerekli işlemleri yap
  this.durationHour = this.duration * 24;

  // sonraki adıma devam et
  next();
});

//? pre() işlemden önce post() işlemden sonra middleware'i çalıştırmaya yarar
tourSchema.post("updateOne", function (doc, next) {
  // kullanıcnın şifresini güncelleme işlemdinde sonra haber veya doğrulama maili gönderilir
  console.log(doc._id, "şifreniz güncellendi maili gönderildi...");

  next();
});

//! Query Middleware
// Sorgulardan önce veya sonra çalıştırdğımız middleware'lerdir.
tourSchema.pre("find", function (next) {
  // premium olanlar her kullanıya göndermek istemidiğimizden yapıla sorgularda otomatik olarka premium olmayanları filtrelyelim
  this.find({ premium: { $ne: true } });

  next();
});

//? Turlar veritbanında alınmaya çalışıldığında
tourSchema.pre(/^find/, function (next) {
  // yapılan sorgudan hesabı inaktif olanları kaldır
  this.populate({
    path: "guides",
    select:
      "-password -__v -passResetToken -passResetExpires -passChangedAt",
  });

  next();
});

//! Aggregate Middleware
// Rapot oluşturma işlemlerinden önce veya sonra çalıştırdğımız middleware'lerdir.
tourSchema.pre("aggregate", function (next) {
  // premium olan turları rapora dahil etmesin
  this.pipeline().push({ $match: { premium: { $ne: true } } });

  next();
});

//! Index
// Kolleksiyonların belirli alanlara göre sıralanmış bir kopyasını tutar.
// Avantaj: Hangi alana göre sıraladıysam o alana göre yapılan filtreleme ve sıralama işlemlerinde daha hızlı cevap.
// Dezavantaj: Oluşturulan her index veritabanında yer kaplar | Ekstra Maliyet | Yazma İşlemlerinde Yavaş
tourSchema.index({ price: 1, ratingsAverage: -1 });

tourSchema.index({ startLocation: "2dsphere" });

// şemayı kullanrak model oluşturuyoruz
const Tour = mongoose.model("Tour", tourSchema);

// controller'da kullanmak için export
module.exports = Tour;
