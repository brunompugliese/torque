insert into model (brand_id, name)
select b.id, v.model
from (values
  ('Subaru', 'Impreza'), ('Subaru', 'Legacy'), ('Subaru', 'Outback'), ('Subaru', 'Forester'),
  ('Subaru', 'XV'), ('Subaru', 'Crosstrek'), ('Subaru', 'WRX'), ('Subaru', 'BRZ'),

  ('Chevrolet', 'Corsa'), ('Chevrolet', 'Classic'), ('Chevrolet', 'Celta'), ('Chevrolet', 'Agile'),
  ('Chevrolet', 'Prisma'), ('Chevrolet', 'Onix'), ('Chevrolet', 'Onix Plus'), ('Chevrolet', 'Aveo'),
  ('Chevrolet', 'Astra'), ('Chevrolet', 'Vectra'), ('Chevrolet', 'Cruze'), ('Chevrolet', 'Meriva'),
  ('Chevrolet', 'Zafira'), ('Chevrolet', 'Spin'), ('Chevrolet', 'Tracker'), ('Chevrolet', 'Captiva'),
  ('Chevrolet', 'Equinox'), ('Chevrolet', 'Trailblazer'), ('Chevrolet', 'S10'), ('Chevrolet', 'Montana'),
  ('Chevrolet', 'Silverado'), ('Chevrolet', 'Camaro'),

  ('Volkswagen', 'Gol'), ('Volkswagen', 'Gol Trend'), ('Volkswagen', 'Senda'), ('Volkswagen', 'Voyage'),
  ('Volkswagen', 'Fox'), ('Volkswagen', 'CrossFox'), ('Volkswagen', 'Suran'), ('Volkswagen', 'Up!'),
  ('Volkswagen', 'Polo'), ('Volkswagen', 'Virtus'), ('Volkswagen', 'Bora'), ('Volkswagen', 'Vento'),
  ('Volkswagen', 'Golf'), ('Volkswagen', 'Passat'), ('Volkswagen', 'Scirocco'), ('Volkswagen', 'Nivus'),
  ('Volkswagen', 'T-Cross'), ('Volkswagen', 'Taos'), ('Volkswagen', 'Tiguan'), ('Volkswagen', 'Saveiro'),
  ('Volkswagen', 'Amarok'),

  ('Ford', 'Falcon'), ('Ford', 'Sierra'), ('Ford', 'Escort'), ('Ford', 'Ka'),
  ('Ford', 'Fiesta'), ('Ford', 'Focus'), ('Ford', 'Mondeo'), ('Ford', 'Mustang'),
  ('Ford', 'EcoSport'), ('Ford', 'Territory'), ('Ford', 'Kuga'), ('Ford', 'Bronco Sport'),
  ('Ford', 'Ranger'), ('Ford', 'Maverick'), ('Ford', 'F-100'), ('Ford', 'F-150'),
  ('Ford', 'Transit'),

  ('BYD (Build Your Dreams)', 'Dolphin'), ('BYD (Build Your Dreams)', 'Dolphin Mini'),
  ('BYD (Build Your Dreams)', 'Seal'), ('BYD (Build Your Dreams)', 'Yuan Plus'),
  ('BYD (Build Your Dreams)', 'Atto 3'), ('BYD (Build Your Dreams)', 'Song Plus'),
  ('BYD (Build Your Dreams)', 'Han'), ('BYD (Build Your Dreams)', 'Tang'),
  ('BYD (Build Your Dreams)', 'Shark'),

  ('Kia', 'Picanto'), ('Kia', 'Rio'), ('Kia', 'Cerato'), ('Kia', 'Soul'),
  ('Kia', 'Seltos'), ('Kia', 'Sportage'), ('Kia', 'Sorento'), ('Kia', 'Carnival'),
  ('Kia', 'K2500'),

  ('Renault', '9'), ('Renault', '11'), ('Renault', '12'), ('Renault', '19'),
  ('Renault', '21'), ('Renault', 'Twingo'), ('Renault', 'Clio'), ('Renault', 'Kwid'),
  ('Renault', 'Sandero'), ('Renault', 'Sandero Stepway'), ('Renault', 'Logan'), ('Renault', 'Symbol'),
  ('Renault', 'Megane'), ('Renault', 'Fluence'), ('Renault', 'Duster'), ('Renault', 'Duster Oroch'),
  ('Renault', 'Captur'), ('Renault', 'Koleos'), ('Renault', 'Kangoo'), ('Renault', 'Alaskan'),
  ('Renault', 'Master'),

  ('Toyota', 'Etios'), ('Toyota', 'Yaris'), ('Toyota', 'Corolla'), ('Toyota', 'Corolla Cross'),
  ('Toyota', 'Camry'), ('Toyota', 'Prius'), ('Toyota', 'RAV4'), ('Toyota', 'SW4'),
  ('Toyota', 'Hilux'), ('Toyota', 'Land Cruiser'), ('Toyota', 'Innova'), ('Toyota', 'GR86'),

  ('Mazda', '2'), ('Mazda', '3'), ('Mazda', '6'), ('Mazda', 'CX-3'),
  ('Mazda', 'CX-30'), ('Mazda', 'CX-5'), ('Mazda', 'CX-9'), ('Mazda', 'MX-5'),
  ('Mazda', 'BT-50'),

  ('Peugeot', '504'), ('Peugeot', '505'), ('Peugeot', '405'), ('Peugeot', '106'),
  ('Peugeot', '206'), ('Peugeot', '207'), ('Peugeot', '208'), ('Peugeot', '306'),
  ('Peugeot', '307'), ('Peugeot', '308'), ('Peugeot', '406'), ('Peugeot', '407'),
  ('Peugeot', '408'), ('Peugeot', '2008'), ('Peugeot', '3008'), ('Peugeot', '5008'),
  ('Peugeot', 'Partner'), ('Peugeot', 'Rifter'), ('Peugeot', 'Expert'), ('Peugeot', 'Boxer'),

  ('Nissan', 'March'), ('Nissan', 'Note'), ('Nissan', 'Tiida'), ('Nissan', 'Versa'),
  ('Nissan', 'Sentra'), ('Nissan', 'Kicks'), ('Nissan', 'X-Trail'), ('Nissan', 'Murano'),
  ('Nissan', 'Pathfinder'), ('Nissan', 'Frontier'), ('Nissan', 'NP300'), ('Nissan', 'Leaf'),

  ('Fiat', '600'), ('Fiat', '128'), ('Fiat', '147'), ('Fiat', 'Regatta'),
  ('Fiat', 'Duna'), ('Fiat', 'Uno'), ('Fiat', 'Tipo'), ('Fiat', 'Palio'),
  ('Fiat', 'Siena'), ('Fiat', 'Punto'), ('Fiat', 'Stilo'), ('Fiat', 'Idea'),
  ('Fiat', 'Linea'), ('Fiat', '500'), ('Fiat', 'Mobi'), ('Fiat', 'Argo'),
  ('Fiat', 'Cronos'), ('Fiat', 'Pulse'), ('Fiat', 'Fastback'), ('Fiat', 'Strada'),
  ('Fiat', 'Toro'), ('Fiat', 'Fiorino'), ('Fiat', 'Ducato'),

  ('Hyundai', 'i10'), ('Hyundai', 'HB20'), ('Hyundai', 'Accent'), ('Hyundai', 'i30'),
  ('Hyundai', 'Elantra'), ('Hyundai', 'Creta'), ('Hyundai', 'Kona'), ('Hyundai', 'Tucson'),
  ('Hyundai', 'Santa Fe'), ('Hyundai', 'H-1'),

  ('Honda', 'Fit'), ('Honda', 'City'), ('Honda', 'Civic'), ('Honda', 'Accord'),
  ('Honda', 'WR-V'), ('Honda', 'HR-V'), ('Honda', 'ZR-V'), ('Honda', 'CR-V'),
  ('Honda', 'Pilot'), ('Honda', 'Wave 110'), ('Honda', 'Biz 125'), ('Honda', 'CG 150 Titan'),
  ('Honda', 'XR 150L'), ('Honda', 'CB 190R'), ('Honda', 'CB 250 Twister'), ('Honda', 'XR 250 Tornado'),
  ('Honda', 'XRE 300'), ('Honda', 'PCX 160'), ('Honda', 'NC 750X'), ('Honda', 'Africa Twin'),

  ('Mitsubishi', 'Colt'), ('Mitsubishi', 'Lancer'), ('Mitsubishi', 'Galant'), ('Mitsubishi', 'ASX'),
  ('Mitsubishi', 'Eclipse Cross'), ('Mitsubishi', 'Outlander'), ('Mitsubishi', 'Montero'), ('Mitsubishi', 'L200'),

  ('Suzuki', 'Alto'), ('Suzuki', 'Fun'), ('Suzuki', 'Celerio'), ('Suzuki', 'Swift'),
  ('Suzuki', 'Baleno'), ('Suzuki', 'Vitara'), ('Suzuki', 'Grand Vitara'), ('Suzuki', 'S-Cross'),
  ('Suzuki', 'Jimny'), ('Suzuki', 'GN 125'), ('Suzuki', 'V-Strom 650'),

  ('Jeep', 'Renegade'), ('Jeep', 'Compass'), ('Jeep', 'Commander'), ('Jeep', 'Cherokee'),
  ('Jeep', 'Grand Cherokee'), ('Jeep', 'Wrangler'), ('Jeep', 'Gladiator'),

  ('Seat', 'Ibiza'), ('Seat', 'Cordoba'), ('Seat', 'Leon'), ('Seat', 'Toledo'),
  ('Seat', 'Altea'), ('Seat', 'Arona'), ('Seat', 'Ateca'), ('Seat', 'Tarraco'),

  ('Rover', '214'), ('Rover', '216'), ('Rover', '416'), ('Rover', '420'),
  ('Rover', '620'), ('Rover', '75'),

  ('Audi', 'A1'), ('Audi', 'A3'), ('Audi', 'A4'), ('Audi', 'A5'),
  ('Audi', 'A6'), ('Audi', 'TT'), ('Audi', 'Q2'), ('Audi', 'Q3'),
  ('Audi', 'Q5'), ('Audi', 'Q7'), ('Audi', 'Q8'),

  ('Volvo', 'S40'), ('Volvo', 'S60'), ('Volvo', 'S80'), ('Volvo', 'V40'),
  ('Volvo', 'V60'), ('Volvo', 'XC40'), ('Volvo', 'XC60'), ('Volvo', 'XC90'),
  ('Volvo', 'EX30'),

  ('Mini', 'One'), ('Mini', 'Cooper'), ('Mini', 'Cooper S'), ('Mini', 'Cabrio'),
  ('Mini', 'Clubman'), ('Mini', 'Countryman'),

  ('Lexus', 'IS'), ('Lexus', 'ES'), ('Lexus', 'UX'), ('Lexus', 'NX'),
  ('Lexus', 'RX'), ('Lexus', 'LX'),

  ('Alfa Romeo', '145'), ('Alfa Romeo', '146'), ('Alfa Romeo', '147'), ('Alfa Romeo', '155'),
  ('Alfa Romeo', '156'), ('Alfa Romeo', '159'), ('Alfa Romeo', '164'), ('Alfa Romeo', 'MiTo'),
  ('Alfa Romeo', 'Giulietta'), ('Alfa Romeo', 'Giulia'), ('Alfa Romeo', 'Stelvio'), ('Alfa Romeo', 'Tonale'),

  ('Mercedes Benz', 'Clase A'), ('Mercedes Benz', 'Clase B'), ('Mercedes Benz', 'Clase C'), ('Mercedes Benz', 'Clase E'),
  ('Mercedes Benz', 'Clase S'), ('Mercedes Benz', 'CLA'), ('Mercedes Benz', 'GLA'), ('Mercedes Benz', 'GLB'),
  ('Mercedes Benz', 'GLC'), ('Mercedes Benz', 'GLE'), ('Mercedes Benz', 'Clase X'), ('Mercedes Benz', 'Vito'),
  ('Mercedes Benz', 'Sprinter'),

  ('Daihatsu', 'Cuore'), ('Daihatsu', 'Charade'), ('Daihatsu', 'Sirion'), ('Daihatsu', 'Move'),
  ('Daihatsu', 'Terios'), ('Daihatsu', 'Feroza'), ('Daihatsu', 'Rocky'),

  ('Cadillac', 'DeVille'), ('Cadillac', 'CTS'), ('Cadillac', 'ATS'), ('Cadillac', 'SRX'),
  ('Cadillac', 'XT5'), ('Cadillac', 'Escalade'),

  ('Isuzu', 'Amigo'), ('Isuzu', 'Rodeo'), ('Isuzu', 'Trooper'), ('Isuzu', 'D-Max'),
  ('Isuzu', 'MU-X'),

  ('Daewoo', 'Tico'), ('Daewoo', 'Matiz'), ('Daewoo', 'Racer'), ('Daewoo', 'Cielo'),
  ('Daewoo', 'Espero'), ('Daewoo', 'Lanos'), ('Daewoo', 'Nubira'), ('Daewoo', 'Leganza'),

  ('BMW', 'Serie 1'), ('BMW', 'Serie 2'), ('BMW', 'Serie 3'), ('BMW', 'Serie 4'),
  ('BMW', 'Serie 5'), ('BMW', 'Serie 7'), ('BMW', 'X1'), ('BMW', 'X2'),
  ('BMW', 'X3'), ('BMW', 'X4'), ('BMW', 'X5'), ('BMW', 'X6'),
  ('BMW', 'Z4'), ('BMW', 'i3'), ('BMW', 'G 310 R'), ('BMW', 'F 850 GS'),
  ('BMW', 'R 1250 GS'),

  ('Dodge', '1500'), ('Dodge', 'Polara'), ('Dodge', 'Coronado'), ('Dodge', 'GTX'),
  ('Dodge', 'Neon'), ('Dodge', 'Caliber'), ('Dodge', 'Journey'), ('Dodge', 'Durango'),
  ('Dodge', 'Charger'), ('Dodge', 'Challenger'), ('Dodge', 'Ram'),

  ('Acura', 'Integra'), ('Acura', 'ILX'), ('Acura', 'TLX'), ('Acura', 'RDX'),
  ('Acura', 'MDX'), ('Acura', 'NSX'),

  ('Citroen', '2CV'), ('Citroen', '3CV'), ('Citroen', 'Mehari'), ('Citroen', 'ZX'),
  ('Citroen', 'Saxo'), ('Citroen', 'Xsara'), ('Citroen', 'Xsara Picasso'), ('Citroen', 'C3'),
  ('Citroen', 'C3 Aircross'), ('Citroen', 'C4'), ('Citroen', 'C4 Lounge'), ('Citroen', 'C4 Cactus'),
  ('Citroen', 'C5'), ('Citroen', 'C5 Aircross'), ('Citroen', 'Basalt'), ('Citroen', 'Berlingo'),
  ('Citroen', 'Jumpy'), ('Citroen', 'Jumper'),

  ('Chery', 'QQ'), ('Chery', 'Face'), ('Chery', 'Fulwin'), ('Chery', 'Arrizo 5'),
  ('Chery', 'Tiggo'), ('Chery', 'Tiggo 2'), ('Chery', 'Tiggo 3'), ('Chery', 'Tiggo 4'),
  ('Chery', 'Tiggo 5'), ('Chery', 'Tiggo 7'), ('Chery', 'Tiggo 8'),

  ('Rouser/Bajaj', 'Boxer 150'), ('Rouser/Bajaj', 'Rouser NS 125'), ('Rouser/Bajaj', 'Rouser NS 160'),
  ('Rouser/Bajaj', 'Rouser NS 200'), ('Rouser/Bajaj', 'Rouser RS 200'), ('Rouser/Bajaj', 'Rouser 220'),
  ('Rouser/Bajaj', 'Dominar 250'), ('Rouser/Bajaj', 'Dominar 400'),

  ('Yamaha', 'Crypton 110'), ('Yamaha', 'YBR 125'), ('Yamaha', 'XTZ 125'), ('Yamaha', 'FZ'),
  ('Yamaha', 'FZ25'), ('Yamaha', 'XTZ 250'), ('Yamaha', 'NMAX'), ('Yamaha', 'R3'),
  ('Yamaha', 'MT-03'), ('Yamaha', 'MT-07'), ('Yamaha', 'MT-09'), ('Yamaha', 'R1'),
  ('Yamaha', 'Tenere 700'), ('Yamaha', 'YZ 250F'), ('Yamaha', 'WR 450F'),

  ('Benelli', 'TNT 15'), ('Benelli', 'TNT 135'), ('Benelli', '180S'), ('Benelli', 'Leoncino 250'),
  ('Benelli', 'TRK 251'), ('Benelli', 'TNT 300'), ('Benelli', '302S'), ('Benelli', 'Imperiale 400'),
  ('Benelli', 'Leoncino 500'), ('Benelli', 'TRK 502'), ('Benelli', 'TNT 600'),

  ('KTM', 'Duke 200'), ('KTM', 'RC 200'), ('KTM', 'Duke 390'), ('KTM', 'RC 390'),
  ('KTM', '390 Adventure'), ('KTM', 'Duke 790'), ('KTM', '790 Adventure'), ('KTM', '1290 Super Adventure'),
  ('KTM', 'SX 250'), ('KTM', 'EXC 300'),

  ('Kawasaki', 'Ninja 300'), ('Kawasaki', 'Ninja 400'), ('Kawasaki', 'Z400'), ('Kawasaki', 'Versys-X 300'),
  ('Kawasaki', 'Ninja 650'), ('Kawasaki', 'Z650'), ('Kawasaki', 'Versys 650'), ('Kawasaki', 'Vulcan S'),
  ('Kawasaki', 'KLR 650'), ('Kawasaki', 'Z900'), ('Kawasaki', 'Ninja ZX-6R'), ('Kawasaki', 'Ninja ZX-10R'),
  ('Kawasaki', 'KX 250'),

  ('Ducati', 'Scrambler'), ('Ducati', 'Monster'), ('Ducati', 'Hypermotard'), ('Ducati', 'Multistrada'),
  ('Ducati', 'Diavel'), ('Ducati', 'Streetfighter'), ('Ducati', 'Panigale V2'), ('Ducati', 'Panigale V4'),

  ('Lifan', '320'), ('Lifan', '520'), ('Lifan', '530'), ('Lifan', '620'),
  ('Lifan', 'X50'), ('Lifan', 'X60'), ('Lifan', 'X70'), ('Lifan', 'Foison'),
  ('Lifan', 'KPR 200'),

  ('Zanella', 'ZB 110'), ('Zanella', 'Due 110'), ('Zanella', 'RX 150'), ('Zanella', 'ZR 150'),
  ('Zanella', 'Styler 150'), ('Zanella', 'Sapucai 150'), ('Zanella', 'Ceccato 150'), ('Zanella', 'Patagonian Eagle 150'),
  ('Zanella', 'Patagonian Eagle 250'), ('Zanella', 'ZTT 200'),

  ('Harley-Davidson', 'Iron 883'), ('Harley-Davidson', 'Sportster'), ('Harley-Davidson', 'Nightster'), ('Harley-Davidson', 'Street Bob'),
  ('Harley-Davidson', 'Softail'), ('Harley-Davidson', 'Fat Boy'), ('Harley-Davidson', 'Heritage Classic'), ('Harley-Davidson', 'Road King'),
  ('Harley-Davidson', 'Street Glide'), ('Harley-Davidson', 'Pan America'),

  ('Royal Enfield', 'Bullet 350'), ('Royal Enfield', 'Classic 350'), ('Royal Enfield', 'Meteor 350'), ('Royal Enfield', 'Hunter 350'),
  ('Royal Enfield', 'Scram 411'), ('Royal Enfield', 'Himalayan'), ('Royal Enfield', 'Interceptor 650'), ('Royal Enfield', 'Continental GT 650'),
  ('Royal Enfield', 'Super Meteor 650'),

  ('Husqvarna', 'Svartpilen 401'), ('Husqvarna', 'Vitpilen 401'), ('Husqvarna', 'Norden 901'), ('Husqvarna', '701 Enduro'),
  ('Husqvarna', 'TC 250'), ('Husqvarna', 'TE 300'), ('Husqvarna', 'FE 350'), ('Husqvarna', 'FC 450'),

  ('Gilera', 'Smash 110'), ('Gilera', 'GX1 125'), ('Gilera', 'VC 150'), ('Gilera', 'Macis 150'),
  ('Gilera', 'Sahel 150'), ('Gilera', 'SMX 200'), ('Gilera', 'YL 200'),

  ('Corven', 'Expert 80'), ('Corven', 'Energy 110'), ('Corven', 'Mirage 110'), ('Corven', 'Hunter 150'),
  ('Corven', 'Triax 150'), ('Corven', 'Triax 250'), ('Corven', 'TXR 250'), ('Corven', 'Indiana 256'),

  ('Motomel', 'Blitz 110'), ('Motomel', 'Go 110'), ('Motomel', 'CG 150'), ('Motomel', 'S2 150'),
  ('Motomel', 'Custom 150'), ('Motomel', 'Skua 150'), ('Motomel', 'Sirius 190'), ('Motomel', 'Dakar 200'),
  ('Motomel', 'Skua 250'),

  ('Porsche', '911'), ('Porsche', '718 Boxster'), ('Porsche', '718 Cayman'), ('Porsche', 'Macan'),
  ('Porsche', 'Cayenne'), ('Porsche', 'Panamera'), ('Porsche', 'Taycan')
) as v(brand, model)
join brand b on b.name = v.brand
on conflict do nothing;
