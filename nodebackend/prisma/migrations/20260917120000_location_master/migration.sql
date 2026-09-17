CREATE TABLE [dbo].[state_masters] (
    [id] NVARCHAR(36) NOT NULL CONSTRAINT [DF_state_masters_id] DEFAULT LOWER(CONVERT(NVARCHAR(36), NEWID())),
    [code] NVARCHAR(20) NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [type] NVARCHAR(30) NOT NULL CONSTRAINT [DF_state_masters_type] DEFAULT 'state',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [DF_state_masters_status] DEFAULT 'active',
    [created_by_user_id] NVARCHAR(36) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_state_masters_created] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [DF_state_masters_updated] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_state_masters] PRIMARY KEY ([id]),
    CONSTRAINT [UQ_state_masters_code] UNIQUE ([code]),
    CONSTRAINT [UQ_state_masters_name] UNIQUE ([name])
);

CREATE TABLE [dbo].[city_masters] (
    [id] NVARCHAR(36) NOT NULL CONSTRAINT [DF_city_masters_id] DEFAULT LOWER(CONVERT(NVARCHAR(36), NEWID())),
    [state_id] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(150) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [DF_city_masters_status] DEFAULT 'active',
    [created_by_user_id] NVARCHAR(36) NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_city_masters_created] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL CONSTRAINT [DF_city_masters_updated] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK_city_masters] PRIMARY KEY ([id]),
    CONSTRAINT [FK_city_masters_state_id] FOREIGN KEY ([state_id]) REFERENCES [dbo].[state_masters]([id]) ON DELETE CASCADE,
    CONSTRAINT [UQ_city_masters_state_name] UNIQUE ([state_id], [name])
);

CREATE INDEX [IX_state_masters_status] ON [dbo].[state_masters]([status]);
CREATE INDEX [IX_city_masters_status] ON [dbo].[city_masters]([status]);
CREATE INDEX [IX_city_masters_name] ON [dbo].[city_masters]([name]);

DECLARE @states TABLE ([code] NVARCHAR(20), [name] NVARCHAR(150), [type] NVARCHAR(30));
INSERT INTO @states ([code], [name], [type]) VALUES
('AP','Andhra Pradesh','state'),('AR','Arunachal Pradesh','state'),('AS','Assam','state'),('BR','Bihar','state'),
('CG','Chhattisgarh','state'),('GA','Goa','state'),('GJ','Gujarat','state'),('HR','Haryana','state'),
('HP','Himachal Pradesh','state'),('JH','Jharkhand','state'),('KA','Karnataka','state'),('KL','Kerala','state'),
('MP','Madhya Pradesh','state'),('MH','Maharashtra','state'),('MN','Manipur','state'),('ML','Meghalaya','state'),
('MZ','Mizoram','state'),('NL','Nagaland','state'),('OD','Odisha','state'),('PB','Punjab','state'),
('RJ','Rajasthan','state'),('SK','Sikkim','state'),('TN','Tamil Nadu','state'),('TS','Telangana','state'),
('TR','Tripura','state'),('UP','Uttar Pradesh','state'),('UK','Uttarakhand','state'),('WB','West Bengal','state'),
('AN','Andaman and Nicobar Islands','union_territory'),('CH','Chandigarh','union_territory'),
('DN','Dadra and Nagar Haveli and Daman and Diu','union_territory'),('DL','Delhi','union_territory'),
('JK','Jammu and Kashmir','union_territory'),('LA','Ladakh','union_territory'),('LD','Lakshadweep','union_territory'),
('PY','Puducherry','union_territory');

INSERT INTO [dbo].[state_masters] ([id], [code], [name], [type], [status], [created_at], [updated_at])
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), s.[code], s.[name], s.[type], 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM @states s
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[state_masters] existing WHERE existing.[code] = s.[code] OR existing.[name] = s.[name]);

DECLARE @cities TABLE ([state_code] NVARCHAR(20), [name] NVARCHAR(150));
INSERT INTO @cities ([state_code], [name]) VALUES
('AP','Visakhapatnam'),('AP','Vijayawada'),('AP','Guntur'),('AP','Nellore'),('AP','Kurnool'),('AP','Tirupati'),
('AR','Itanagar'),('AR','Naharlagun'),('AS','Guwahati'),('AS','Silchar'),('AS','Dibrugarh'),('AS','Jorhat'),
('BR','Patna'),('BR','Gaya'),('BR','Bhagalpur'),('BR','Muzaffarpur'),('BR','Darbhanga'),
('CG','Raipur'),('CG','Bhilai'),('CG','Bilaspur'),('CG','Korba'),('GA','Panaji'),('GA','Margao'),('GA','Vasco da Gama'),
('GJ','Ahmedabad'),('GJ','Surat'),('GJ','Vadodara'),('GJ','Rajkot'),('GJ','Gandhinagar'),('GJ','Bhavnagar'),('GJ','Jamnagar'),
('HR','Gurugram'),('HR','Faridabad'),('HR','Panipat'),('HR','Ambala'),('HR','Hisar'),('HR','Karnal'),('HR','Rohtak'),
('HP','Shimla'),('HP','Dharamshala'),('HP','Mandi'),('HP','Solan'),('JH','Ranchi'),('JH','Jamshedpur'),('JH','Dhanbad'),('JH','Bokaro'),
('KA','Bengaluru'),('KA','Mysuru'),('KA','Mangaluru'),('KA','Hubballi'),('KA','Belagavi'),('KA','Kalaburagi'),
('KL','Thiruvananthapuram'),('KL','Kochi'),('KL','Kozhikode'),('KL','Thrissur'),('KL','Kollam'),('KL','Kannur'),
('MP','Indore'),('MP','Bhopal'),('MP','Jabalpur'),('MP','Gwalior'),('MP','Ujjain'),('MP','Sagar'),
('MH','Mumbai'),('MH','Pune'),('MH','Nagpur'),('MH','Nashik'),('MH','Thane'),('MH','Navi Mumbai'),('MH','Aurangabad'),('MH','Solapur'),('MH','Kolhapur'),
('MN','Imphal'),('ML','Shillong'),('MZ','Aizawl'),('NL','Kohima'),('NL','Dimapur'),
('OD','Bhubaneswar'),('OD','Cuttack'),('OD','Rourkela'),('OD','Sambalpur'),('OD','Puri'),
('PB','Ludhiana'),('PB','Amritsar'),('PB','Jalandhar'),('PB','Patiala'),('PB','Bathinda'),('PB','Mohali'),
('RJ','Jaipur'),('RJ','Jodhpur'),('RJ','Udaipur'),('RJ','Kota'),('RJ','Ajmer'),('RJ','Bikaner'),('RJ','Alwar'),
('SK','Gangtok'),('TN','Chennai'),('TN','Coimbatore'),('TN','Madurai'),('TN','Tiruchirappalli'),('TN','Salem'),('TN','Tirunelveli'),
('TS','Hyderabad'),('TS','Warangal'),('TS','Nizamabad'),('TS','Karimnagar'),('TS','Khammam'),
('TR','Agartala'),('UP','Lucknow'),('UP','Kanpur'),('UP','Ghaziabad'),('UP','Noida'),('UP','Greater Noida'),('UP','Agra'),('UP','Varanasi'),('UP','Prayagraj'),('UP','Meerut'),('UP','Gorakhpur'),('UP','Bareilly'),
('UK','Dehradun'),('UK','Haridwar'),('UK','Haldwani'),('UK','Roorkee'),('WB','Kolkata'),('WB','Howrah'),('WB','Durgapur'),('WB','Asansol'),('WB','Siliguri'),
('AN','Port Blair'),('CH','Chandigarh'),('DN','Daman'),('DN','Silvassa'),('DL','New Delhi'),('DL','Delhi'),('DL','Dwarka'),('DL','Rohini'),('DL','Pitampura'),('DL','Saket'),('DL','Karol Bagh'),
('JK','Srinagar'),('JK','Jammu'),('LA','Leh'),('LA','Kargil'),('LD','Kavaratti'),('PY','Puducherry'),('PY','Karaikal');

INSERT INTO [dbo].[city_masters] ([id], [state_id], [name], [status], [created_at], [updated_at])
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), s.[id], c.[name], 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM @cities c
JOIN [dbo].[state_masters] s ON s.[code] = c.[state_code]
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[city_masters] existing WHERE existing.[state_id] = s.[id] AND existing.[name] = c.[name]
);
